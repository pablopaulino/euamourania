import { getSupabase, supabaseConfigurado } from "../assets/js/services/supabaseClient.js";
import { adminFetch, invalidateAdminData } from "./data-cache.js";

if (supabaseConfigurado()) {
  const db = getSupabase({ global: { fetch: adminFetch } });
  let userId;
  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      invalidateAdminData();
      location.replace("/admin/login.html");
    } else if (userId && session?.user.id && userId !== session.user.id) {
      location.reload();
    }
    userId = session?.user.id;
  });
}
await import("./admin.js");
