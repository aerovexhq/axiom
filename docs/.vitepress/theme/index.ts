import DefaultTheme from "vitepress/theme";
import "./custom.css";
import ReleaseDownloader from "./components/ReleaseDownloader.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: any }) {
    app.component("ReleaseDownloader", ReleaseDownloader);
  }
};
