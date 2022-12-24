import {UI} from './ui'

const ui = new UI();
document.getElementById('update-config-btn')!.onclick = () => ui.updateConfigUI();
ui.start();

