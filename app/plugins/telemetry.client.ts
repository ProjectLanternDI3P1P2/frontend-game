/**
 * ADR-FE-013 — Browser errors and Core Web Vitals instrumentation.
 * ADR-FE-014 — Field measurements are the reference for the public-site
 * budgets (LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 at the 75th percentile);
 * a local Lighthouse score never replaces them.
 *
 * The plugin is `.client` only: these signals only exist in a real browser,
 * even though the pages themselves are prerendered or server rendered
 * (ADR-FE-003).
 */
import { onCLS, onINP, onLCP } from "web-vitals";
import { createTelemetryReporter } from "~/shared/utils/telemetry";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const router = useRouter();

  const reporter = createTelemetryReporter(
    { app: config.public.appName, version: config.public.appVersion },
    config.public.telemetryEndpoint,
    // Public traffic is larger than the game client's: sample the vitals.
    { sampleRate: 0.25 },
  );

  const currentRoute = () =>
    router.currentRoute.value.matched.at(-1)?.path ?? router.currentRoute.value.path;

  const reportVital = ({
    name,
    value,
    rating,
  }: {
    name: string;
    value: number;
    rating: string;
  }) => {
    reporter.report({
      type: "web-vital",
      name,
      value: Math.round(value),
      rating,
      route: currentRoute(),
    });
  };
  onLCP(reportVital);
  onINP(reportVital);
  onCLS((v) => reportVital({ ...v, value: Number(v.value.toFixed(4)) }));

  window.addEventListener("error", (event) => {
    reporter.report({
      type: "browser-error",
      name: "window.error",
      route: currentRoute(),
      message: event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reporter.report({
      type: "browser-error",
      name: "unhandledrejection",
      route: currentRoute(),
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  nuxtApp.vueApp.config.errorHandler = (error, _instance, info) => {
    reporter.report({
      type: "browser-error",
      name: "vue.errorHandler",
      route: currentRoute(),
      operation: info,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  };

  return { provide: { telemetry: reporter } };
});
