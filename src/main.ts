import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { ALPHA_EVENTS } from "../modules/shared/lib/events";

export { ALPHA_EVENTS };

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
