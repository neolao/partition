import { createEditor } from "./editor";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
	const editor = createEditor(app);
	new ResizeObserver(editor.redraw).observe(app);
}
