import { onRequestPost as __api_submit_contact_ts_onRequestPost } from "C:\\Projects\\MakingCode.IO.Site\\functions\\api\\submit-contact.ts"

export const routes = [
    {
      routePath: "/api/submit-contact",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_submit_contact_ts_onRequestPost],
    },
  ]