import './style.css'
import {WifiManagerUi} from "./wifi-manager-ui";

const ui = new WifiManagerUi();
ui.start();
(window as any).ui = ui;