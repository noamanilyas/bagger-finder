export async function register() {
  // Keep this exact `if` around the import: Next drops it from its edge build only in this form.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.AUTO_SCRAPE !== "false") {
    const { startScheduler } = await import("./lib/scheduler");
    await startScheduler();
  }
}
