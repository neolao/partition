import { renderEmptyStaff } from "./staff";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
	const draw = () => renderEmptyStaff(app, app.clientWidth);
	draw();
	new ResizeObserver(draw).observe(app);
}
