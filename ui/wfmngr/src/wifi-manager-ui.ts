import {INetworkItem, WifiSecurity} from "./types";
import {UiUtils} from "./utils";
import * as Handlebars from "handlebars";

const WifiLevel = {
    GOOD: 0,
    NORMAL: 1,
    BAD: 2,
    UNUSABLE: 3
}

interface UINetworkItem extends INetworkItem {
    level: number,
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

    public connect(ssid: unknown, security: unknown) {
        let password: string | undefined = undefined;
        if (security != 0) {
            const promtResult = window.prompt("Please enter WIFI password");
            password = promtResult ? promtResult : undefined;
        }
        const connectData = {ssid, password};

        return this.runTask(() => {
                return fetch('/api/connect', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(connectData)
                    }
                )
                    .then((response) => response.json())
                    .then((data) => {
                        console.log("OMF", data);
                        return data;
                    });
            }
        );
    }

    public start() {
        console.log('Starting');
        setInterval(() => this.readNetworkList(), 1500);
    }

    private renderNetworks(newNetworks: UINetworkItem[]) {
        if (JSON.stringify(newNetworks) != JSON.stringify(this.foundNetworks)) {
            this.foundNetworks = newNetworks;
            this.outlet.innerHTML = this.networksTemplate(this.foundNetworks);
        }
    }


    private readNetworkList() {
        return this.runTask(() => {
            return fetch('/api/networks')
                .then((response) => response.json())
                .then((data: INetworkItem[]) => {
                    const uiData: UINetworkItem[] = data.map((n) => {
                        const securityValue = WifiSecurity[n.security];
                        let level: number;
                        let rssiColor: string;
                        if (n.rssi > -67) {
                            level = WifiLevel.GOOD;
                            rssiColor = "#32CD32";
                        } else if (n.rssi > -79) {
                            level = WifiLevel.NORMAL;
                            rssiColor = "#800000";
                        } else if (n.rssi > -80) {
                            level = WifiLevel.BAD;
                            rssiColor = "#778899";
                        } else {
                            level = WifiLevel.UNUSABLE;
                            rssiColor = "#800000";
                        }
                        return Object.assign(n, {securityValue, rssiColor, level}) as UINetworkItem;
                    })
                    const grouped = uiData.reduce((map, item) => {
                        if (!map.has(item.ssid)) {
                            map.set(item.ssid, []);
                        }
                        map.get(item.ssid)!.push(item);
                        return map;
                    }, new Map<string, UINetworkItem[]>);

                    const sorted = Array.from(grouped.entries())
                        .sort(([n1, v1], [n2, v2]) => {
                            const lev1 = v1.map((i) => i.level);
                            const lev2 = v2.map((i) => i.level);
                            const levelSort = Math.round(UiUtils.mean(lev1)) - Math.round(UiUtils.mean(lev2));
                            if (levelSort !== 0) {
                                return levelSort;
                            } else if (n1 === "") {
                                return 1;
                            } else if (n2 === "") {
                                return -1;
                            } else {
                                return n1.localeCompare(n2);
                            }
                        });
                    const foundItems = sorted.map(([, v]) => v[0]);
                    this.renderNetworks(foundItems);
                    return data;
                })
                .catch((e) => {
                    console.error('Can not fetch WIFI networks', e)
                });
        });
    }


    private runTask<T>(task: () => Promise<T>): Promise<unknown> {
        this.currentTask = this.currentTask.then(() => task(), () => task());
        return this.currentTask;
    }
}