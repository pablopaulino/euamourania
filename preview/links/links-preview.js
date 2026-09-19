import "/assets/js/pages/links-page.js";

document.getElementById("year").textContent = new Date().getFullYear();
Promise.allSettled([
  import("/assets/js/pages/analytics-page.js"),
  import("/assets/js/pages/google-analytics-page.js"),
  import("/assets/js/pages/error-monitor.js")
]);
