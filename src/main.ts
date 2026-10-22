import { APP_TITLE } from "./title";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
	app.textContent = APP_TITLE;
}
