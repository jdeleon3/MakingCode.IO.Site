---
title: 'A Job-Posting Fraud Classifier — and the Gap Between the Model and the Demo'
description: 'A class-project XGBoost classifier hits 98% accuracy and a 0.985 ROC-AUC detecting fake job postings offline. The deployed demo does not call it — the API route is a coin flip with a TODO comment above it. Here is both halves of that story.'
pubDate: 2026-07-29
heroImage: '../../assets/projects/fraud-classifier.png'
tags: ['machine-learning', 'nlp', 'aws', 'class-project']
domain: 'Text Classification / NLP'
techStack:
  [
    'Vue 3',
    'FastAPI',
    'AWS Lambda',
    'API Gateway',
    'CloudFront',
    'S3',
    'AWS CDK',
    'XGBoost',
    'scikit-learn',
    'NLTK',
  ]
impact: 'A 98%-accuracy offline classifier, and a deployed demo that never learned to call it — which turned out to be the more useful lesson.'
featured: true
---

The classifier behind this project is 98.01% accurate on a held-out test set, with a 0.985 ROC-AUC. The live demo at [d3f9oo5yz3zsdv.cloudfront.net](https://d3f9oo5yz3zsdv.cloudfront.net/) does not call it. The `/api/evaluatejobpost` route that's supposed to run the model instead does this:

```python
@api_router.post("/evaluatejobpost", response_model=AnalysisResults)
def eval_jobpost(job: JobPost):
    #TODO: Implement the logic to evaluate the job post and return the analysis results.
    print(f"Evaluating job post: {job}")
    isrealFactor = random.randint(1, 100)
    isreal = (isrealFactor % 2 == 0)
    results = AnalysisResults()
    results.is_real = isreal
    results.job_post = job
    return results
```

A coin flip, with the `TODO` comment still sitting above it. That's not a hedge or a caveat buried in a limitations section — it's the actual production code, and it's the most useful fact in this writeup.

## The assignment

This was CS 6330 (Data Science), Angelo State University, Spring B 2025 — a team project with Darshan Joshi and Dae-Breona Armour, not a solo build. The brief: take a real, messy, imbalanced dataset, build and evaluate a classifier, and wrap it in something deployable. We used the Kaggle ["Real or Fake / Fake Job Posting Prediction"](https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction) dataset — 17,880 rows, 18 columns, **17,014 real postings and 866 fake ones** (roughly 4.8% fraud). That imbalance drives almost every modeling decision below.

## The model that actually works

Feature pipeline, in order: lowercase and strip non-word characters, NLTK tokenize + Porter-stem with English stopwords removed, then TF-IDF vectorize the `description` field. Three engineered numeric features get appended alongside the TF-IDF matrix — word count, Flesch reading-ease score, and a text-complexity/grade-level score (both from `textstat`) — scaled and stacked in via `scipy.sparse.hstack`.

From there: TruncatedSVD down to 300 components, SMOTE to correct the class imbalance, then an `XGBClassifier` on an 80/20 stratified split. Results on the held-out test set:

| Class | Precision | Recall | F1-score | Support |
| --- | --- | --- | --- | --- |
| Real (0) | 0.99 | 0.99 | 0.99 | 3,403 |
| Fake (1) | 0.81 | 0.77 | 0.79 | 173 |

Confusion matrix: 3,371 true negatives, 32 false positives, 39 false negatives, 134 true positives. **Accuracy 98.01%, fraud-class precision 80.72%, fraud-class recall 77.46%, fraud-class F1 79.06%, ROC-AUC 0.9852.**

We didn't start there. An Isolation Forest run against the same TF-IDF/SVD features (contamination=0.05) came back with fraud-class precision and recall both around 11%, and a ROC-AUC of 0.53 — barely better than random guessing, despite ~91% raw accuracy, which is exactly the kind of accuracy-on-an-imbalanced-set trap this dataset sets for you. A logistic regression baseline using only `company_profile_readability` got the label wrong 27% of the time. Both are in the notebook as evidence for why supervised learning with SMOTE won, not as filler.

## The architecture around it

Vue 3 SPA, one real page — paste a job title/description or a Freelancer.com project URL and get a real/fake verdict. Backend is FastAPI, wrapped for Lambda with Mangum, shipped as a Docker container on `public.ecr.aws/lambda/python:3.11`. The AWS CDK stack (`cdk_stack.py`) provisions exactly five things:

- `DockerImageFunction` — the FastAPI/Mangum Lambda, built straight from the backend's Dockerfile, 30s timeout
- `LambdaRestApi` — API Gateway, `proxy=True`, regional
- A private S3 bucket for the built frontend (`removal_policy=DESTROY`, `auto_delete_objects=True` — dev-grade by design, not durable)
- A CloudFront `OriginAccessIdentity` granting read access to that bucket
- One CloudFront distribution doing double duty: `/*` serves the Vue SPA from S3 (with 403/404 → `index.html` for client-side routing), `/api/*` proxies to API Gateway with caching disabled

That distribution is also geo-restricted to an allowlist of `US` and `CA` — anyone outside North America hitting the live URL gets blocked at the edge, which I mention because it's the kind of detail that only shows up by reading the actual stack definition, not by describing what a "typical" CDK deployment looks like.

## Where the wiring stops

The trained artifacts — `model.pkl` (XGBoost) and `text_classifier.pkl` (the fitted TF-IDF vectorizer + scaler) — exist in the repo. The backend's `services/modelservice.py`, which should load them and run inference, is a zero-byte file. The Dockerfile that builds the Lambda image never copies either `.pkl` into it. So even if `modelservice.py` existed, the model wouldn't be in the container to load. Three separate, compounding gaps between "the model works" and "the demo runs the model."

There's a second loose end worth naming: the plain training script (`ml/model.py`) that produced the committed `model.pkl` doesn't include the SVD or SMOTE steps that the notebook's higher-scoring pipeline uses. The 98%-accuracy numbers above are the notebook's run, not necessarily what's sitting in that pickle file. I haven't reconciled the two.

## What I'd fix first

In order: copy the two `.pkl` files into the Lambda image and implement `modelservice.py` to actually load and call them; make `ml/model.py` match the notebook's SVD+SMOTE pipeline so there's one canonical training path instead of two; add a CloudFront invalidation step to the frontend deploy workflow (right now a new `aws s3 sync` doesn't necessarily show up at the live URL because nothing busts the cache). None of these are hard — they just weren't done, because the class deliverable was the model and the report, not a production inference path, and that's a distinction worth stating instead of blurring.

## What this actually is

A team class project, evaluated rigorously offline, deployed just far enough to look real. If you only look at the live demo, you'd conclude the model is a coin flip. If you only look at the notebook, you'd conclude it's a 98%-accuracy classifier in production. Neither is true on its own — that gap is the whole reason this is worth writing up instead of just linking a GitHub repo.

[Live demo](https://d3f9oo5yz3zsdv.cloudfront.net/) (US/Canada only, and yes, it'll flip a coin on you) · repo is private coursework, not linked here.
