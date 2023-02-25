import {INetworkItem, WifiSecurity} from "./types";
import {UiUtils} from "./utils";
import * as Handlebars from "handlebars";

interface UINetworkItem extends INetworkItem{
    securityValue: string;
    rssiColor: string;
}

export class WifiManagerUi {

    private currentTask: Promise<unknown> = Promise.resolve();

    private foundNetworks: UINetworkItem[] = [];
    private outlet: HTMLDivElement;
    private networksTemplate: Handlebars.TemplateDelegate<UINetworkItem[]>;

    public constructor() {
        this.outlet = UiUtils.findByIdStrict("content-outlet");
        this.networksTemplate = Handlebars.compile(UiUtils.findByIdStrict("networks-template").innerHTML);
    }

    public start() {
        console.log('Starting');
        setInterval(() => this.readNetworkList(), 500);
    }

    private renderNetworks(newNetworks: INetworkItem[]) {
        this.runTask(() => {
            const newUiItems = newNetworks.map((n) => {
                const securityValue = WifiSecurity[n.security];
                let rssiColor: string;
                if (n.rssi > -67) {
                    rssiColor = "green";
                } else if (n.rssi > -79) {
                    rssiColor = "yellow";
                } else if (n.rssi > -80) {
                    rssiColor = "red";
                } else {
                    rssiColor = "red";
                }
                return Object.assign(n, {securityValue, rssiColor}) as UINetworkItem;
            });
            if (JSON.stringify(newUiItems) != JSON.stringify(this.foundNetworks)) {
                this.foundNetworks = newUiItems;
                this.outlet.innerHTML = this.networksTemplate(this.foundNetworks);
            }
            return Promise.resolve(this.foundNetworks);
        });
    }


    private readNetworkList() {
        return this.runTask(() => {
            return fetch('/api/networks')
                .then((response) => response.json())
                .then((data: INetworkItem[]) => {
                    const grouped = data.reduce((map, item) => {
                        if (!map.has(item.ssid)) {
                            map.set(item.ssid, []);
                        }
                        map.get(item.ssid)!.push(item);
                        return map;
                    }, new Map<string, INetworkItem[]>);

                    const sorted = Array.from(grouped.entries())
                        .sort(([, v1], [, v2]) => {
                            const sig1 = v1.map((i) => i.rssi);
                            const sig2 = v2.map((i) => i.rssi);
                            return UiUtils.mean(sig2) - UiUtils.mean(sig1);
                        });
                    const foundItems = sorted.map(([, v]) => v[0]);
                    console.log("sorted", foundItems);
                    this.renderNetworks(foundItems);
                    return data;
                })
                .catch((e) => {
                    console.error('Can not Mqtt read config', e)
                });
        });
    }


    private runTask<T>(task: () => Promise<T>): Promise<unknown> {
        this.currentTask = this.currentTask.then(() => task(), () => task());
        return this.currentTask;
    }
}