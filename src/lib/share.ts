import type { Product } from "../../data/schema.ts";
import { showToast } from "./toast-bus";

/**
 * Web Share API when available (real mobile browsers), else copy a
 * shareable product URL to the clipboard, else an honest "can't share from
 * here" toast — never a silent no-op (CLAUDE.md rule 2). No network call,
 * no user data leaves the device beyond the public product path itself.
 */
export async function shareProduct(product: Product): Promise<void> {
  const url = `${window.location.origin}/product/${product.id}`;
  const title = `${product.brand} ${product.title}`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
      return; // the OS share sheet is its own confirmation — no toast needed
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return; // user cancelled, not an error
      // fall through to clipboard below
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard");
      return;
    } catch {
      // fall through
    }
  }

  showToast("Sharing isn't available on this device", { tone: "warning" });
}
