export default {
    server: {
        proxy: {
            '/api': `http://${process.env.ESP32_IP}`,
        }
    }
}