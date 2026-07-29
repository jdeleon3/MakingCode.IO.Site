import { onRequestPost as __api_submit_comment_ts_onRequestPost } from "C:\\Projects\\MakingCode.IO.Site\\functions\\api\\submit-comment.ts"
import { onRequestPost as __api_submit_contact_ts_onRequestPost } from "C:\\Projects\\MakingCode.IO.Site\\functions\\api\\submit-contact.ts"

export const routes = [
    {
      routePath: "/api/submit-comment",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_submit_comment_ts_onRequestPost],
    },
  {
      routePath: "/api/submit-contact",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_submit_contact_ts_onRequestPost],
    },
  ]