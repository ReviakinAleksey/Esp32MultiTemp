import {UI} from './ui'

const ui = new UI();
document.getElementById('update-config-btn')!.onclick = () => ui.updateConfigUI();
document.getElementById('update-broker-btn')!.onclick = () => {
    console.log("TOTO: broker");
}

ui.start();

