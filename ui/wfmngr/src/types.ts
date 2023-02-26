export const WifiSecurity = {
    0: "OPEN",
    1: "WEP",
    2: "WPA_PSK",
    3: "WPA_WPA2_PSK",
    4: "WPA_WPA2_PSK",
    5: "WPA2_ENTERPRISE",
    6: "WPA3_PSK",
    7: "WPA2_WPA3_PSK",
    8: "WAPI_PSK",
    9: "OWE",
    10: "MAX",
}

export interface INetworkItem {
    security: keyof typeof WifiSecurity;
    hidden: boolean;
    rssi: number;
    ssid: string;
    bssid: string;
}


export interface IConnectSuccess {
    connected: true;
    ssid: string;
    status: number;
    ip: string;
}

export interface IConnectFailed {
    connected: false;
    ssid: string;
    status: number;
}

export type ConnectResponse = IConnectSuccess | IConnectFailed;