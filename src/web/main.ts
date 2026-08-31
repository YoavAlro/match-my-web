import { AdaptationController } from "./adaptation-controller";
import { AssistiveController } from "./assistive-controller";
import { HarborlineRenderer } from "./demo-renderer";
import { createApprovedDesignStorage } from "./storage";
import { registerTweaksyWebMcpTools } from "./webmcp";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Harborline is missing required element: ${selector}`);
  return element;
}

const root = requiredElement<HTMLElement>("[data-tweaksy-demo]");
const controller = new AdaptationController(
  new HarborlineRenderer(root),
  createApprovedDesignStorage(),
);
const assistive = new AssistiveController(controller, root);

document.documentElement.classList.add("tweaksy-live-ready");

try {
  await registerTweaksyWebMcpTools(controller, root, assistive);
} catch (error) {
  // WebMCP is optional. The site remains a normal, readable publication when
  // opened in a browser without an agent-capable model context.
  console.error("WebMCP registration unavailable", error);
}

export { assistive, controller };
