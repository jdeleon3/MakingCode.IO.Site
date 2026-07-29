---
title: 'Bridging the Black Box: Explainable Anomaly Detection for Critical Infrastructure'
description: 'A DOD/ARL-funded capstone: a Kafka/Spark/Neo4j/TimescaleDB pipeline feeding a two-stage heterogeneous graph transformer that hits 87.8% accuracy detecting attacks on a hardware-in-the-loop water testbed — trained on 369 labeled graph snapshots, a number that should temper every other number in this post.'
pubDate: 2026-07-29
tags: ['machine-learning', 'security', 'graph-neural-networks', 'academic-research']
domain: 'Critical Infrastructure Security / Explainable AI'
techStack:
  [
    'Kafka',
    'Spark',
    'Neo4j',
    'TimescaleDB',
    'PyTorch Geometric',
    'FastAPI',
    'Streamlit',
    'Docker',
    'Captum',
  ]
impact: 'A five-person, DOD/ARL-funded capstone that got a two-stage heterogeneous GNN to 87.8% accuracy on a physical water-distribution testbed — on 369 labeled graph snapshots, which is the number that should temper every other number in this post.'
featured: true
---

The two-stage graph neural network at the center of this project hits 87.8% accuracy and a macro-F1 of 0.806 detecting cyber and physical attacks against a hardware-in-the-loop water distribution testbed. The labeled dataset behind that number is 369 graph snapshots — 280 normal, 89 across four attack types, with some classes down to single-digit support in the test set. Read every number below with that ratio in mind.

## The team and the funding

This was a five-person capstone at Angelo State University — Bill Mitchell, Serena Reese, Tatum Beaugh, Amiran Fields, and me — advised by Dr. Erdogan Dogdu and Dr. Roya Choupani, funded by the U.S. Army Research Laboratory (Grant No. W911NF-24-2-0180, TTU Subaward 21C284-01) under a Department of War program for cybersecurity research and workforce development. We published the work as "Bridging the Black Box: Explainable Anomaly Detection for Critical Infrastructure Systems." Team work, academic research, not a commercial deployment — none of what follows should be read as production-hardened.

## The dataset

We used Faramondi et al.'s hardware-in-the-loop water distribution testbed (WDT) dataset from IEEE Dataport (DOI 10.21227/rbvf-2h90) — real PLCs and an HMI controlling physical tanks, pumps, and valves, not a pure simulation. Our local copy is 4.4GB: roughly 29.8 million raw network-log rows across four attack CSVs and two normal-traffic CSVs, plus much smaller physical-sensor CSVs (1,200–3,400 rows each). The combined testbed inventory is 8 tanks, 6 pumps, 4 flow sensors, and 22 valves. Attack types split into cyber (DoS, network scanning, MITM) and physical (water leak, pump failure, valve breakdown).

One detail that only shows up from reading the actual ingest code: the raw CSVs contain the label `"nomal"` for normal traffic — a typo baked into the source dataset — which our Spark loader explicitly corrects (`when(col("Label") == "nomal", lit("normal"))`) before anything downstream sees it.

## The pipeline

Ingestion runs through Kafka in KRaft mode (no ZooKeeper), with explicitly partitioned topics — `Data.Raw.Physical` and `Data.Raw.Scada` at 16 partitions each, `Anomaly.Predict` and `Data.Graphs` also at 16, single-partition topics for `Data.Analysis`, `Data.Error`, and `Anomaly.Alerts`. A Spark 3.5.1 batch job loads the raw testbed CSVs and pushes them onto those topics; consumers write raw records into TimescaleDB hypertables (`phys_raw`, `scada_raw`), which continuous aggregates roll up into 10-, 16-, and 30-second buckets. A graph-generator consumer turns each time bucket into a Neo4j property-graph snapshot — `Asset` nodes (with `PLC`, `HMI`, `Tank`, `Pump`, `Valve`, `FlowSensor` sub-labels), `Endpoint` and `Measurement` nodes, relationships like `FEEDS_TO`, `CONTROLS`, and `ISSUES_COMMAND_TO`. A FastAPI harness triggers each pipeline stage; a Streamlit dashboard reads the results back out of Postgres and Neo4j.

## The model

The current architecture is a two-stage Heterogeneous Graph Transformer, built on PyTorch Geometric's `HGTConv` — not the single autoencoder our published paper describes; the pipeline kept evolving after submission. Stage one is a binary normal-vs-anomaly detector (`BCEWithLogitsLoss`, capped positive-class weighting, decision threshold 0.6). Stage two is a 5-way classifier — `normal`, `scan`, `dos`, `mitm`, `physical fault` — that only runs on graphs stage one flags as anomalous.

Hyperparameters as actually configured in the training call: binary detector at `hidden_dim=64`, 3 HGT layers, 2 attention heads, dropout 0.5, learning rate 0.005, up to 150 epochs with early stopping (patience 40); the classifier at `hidden_dim=84`, 3 layers, 4 heads, learning rate 0.001, same early-stopping schedule. Batch size 32 throughout, Adam optimizer, `ReduceLROnPlateau` scheduler.

Final test-set results (74 graph snapshots):

| class | precision | recall | f1 | support |
| --- | --- | --- | --- | --- |
| normal | 0.912 | 0.929 | 0.920 | 56 |
| scan | 0.333 | 0.667 | 0.444 | 3 |
| dos | 1.000 | 1.000 | 1.000 | 2 |
| mitm | 1.000 | 1.000 | 1.000 | 5 |
| physical fault | 1.000 | 0.500 | 0.667 | 8 |

Overall accuracy 0.878, macro-F1 0.806, weighted-F1 0.881. The perfect 1.0 scores on `dos` and `mitm` come from test sets of 2 and 5 examples — that's not a claim the model has "solved" those attack types, it's a claim about two very small samples. `scan`'s 0.444 F1 on 3 examples is the more honest signal of where this model actually struggles.

## Explainability — declared vs. implemented

The system's schema declares three XAI backends: SHAP, LIME, and GNNExplainer. Only one is actually wired into the training and inference loop that produces real output: Captum's `IntegratedGradients`, run automatically against every predicted-anomaly test sample, exporting per-feature and per-node attribution scores as JSON and CSV. `src/xai/Shap.py` and `src/xai/Lime.py` exist as files — both are literal `pass` stubs implementing an abstract `explain()` method that does nothing. PyTorch Geometric's native `GNNExplainer` is implemented too, but for a link-prediction task structurally separate from the graph-classification path that actually runs — a parallel exploration, not part of the production pipeline. SHAP does get real use elsewhere in the repo, via `shap.TreeExplainer` against a completely different model family (XGBoost, in a notebook, on row-level data) — a different unit of analysis from anything the GNN pipeline produces.

## What's still stubbed

Being specific instead of hand-wavy about "known limitations": the alerts consumer (`alerts_consumer.py`) reads `Anomaly.Alerts` off Kafka and does nothing with it — the handler body is entirely comments, no database write, no MITRE ATT&CK lookup, despite the architecture implying that's the intended behavior. `src/models/xgboost.py` — meant to be a production-parallel path to the GNN — is a stub class where every method (`train`, `predict`, `explain`, `save_model`) is `pass`; it's still a selectable option in the API, but there's no code behind it. The Streamlit dashboard queries a Postgres table (`alerts`) and column (`assets.active`) that `init_db.py` never creates; the queries are wrapped in try/except, so those panels silently render empty instead of erroring. And the anomaly-detection decision threshold is configured three different ways across three files (0.5, 0.6, and 0.35 as separate defaults) — a real inconsistency, not a rounding difference.

## The stronger numbers live somewhere else

A separate XGBoost baseline, built on row-level 30-second network-flow aggregates rather than graph snapshots, scored better in isolation — 98.6% accuracy and a 0.999 ROC-AUC on a binary detection task with ~352,000 rows. Those numbers exist only in ad hoc notebooks, never productionized, and they're not measuring the same thing as the GNN's graph-level results above — different unit of analysis, much larger n, no explainability layer attached. It would be easy to quote 98.6% as "the" result for this project. It isn't; it's a different experiment on a different representation of the same underlying data, and the honest comparison is "the GNN pipeline is what's actually running end to end, and it scores lower, on far less labeled data, with explainability attached."

## What I'd call the actual finding

Getting a GNN pipeline this far — real-time ingestion, graph construction, two-stage detection, and attribution-based explanations, all running against a physical testbed instead of a static CSV — was the hard part, and it worked. The honest caveat is that "worked" here means 369 labeled examples and several stub components, not a system ready to watch a real water utility. That's the actual state of DOD-funded academic research at the capstone stage: real infrastructure, real constraints, and results that are promising rather than deployable.
