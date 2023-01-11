import {IBoardConfig, IMqttConfig, ISensorsHash, Plotly} from "./types";
import {PlotData} from "plotly.js";

export class UI {
    private chartDiv: string;
    private debugCont: HTMLDivElement;
    private sensorsCont: HTMLDivElement;
    private sensorsTemplate: HandlebarsTemplateDelegate<any>;
    private brokerTemplate: HandlebarsTemplateDelegate<any>;

    private calibrationTemplate: HandlebarsTemplateDelegate<any>;
    private brokerCont: HTMLDivElement;
    private viewSwitchButton: HTMLButtonElement;
    private calibrationDialog: HTMLDialogElement;

    private currentConfig: IBoardConfig | null = null;
    private currentTask: Promise<unknown> = Promise.resolve();

    private viewState: "EMA" | "CALIBRATION" = "EMA";

    constructor() {
        this.chartDiv = "chart";
        this.debugCont = document.getElementById("debug-cont") as HTMLDivElement;
        this.debugCont.innerHTML = "";
        this.viewSwitchButton = document.getElementById("view-switch-btn") as HTMLButtonElement;
        this.sensorsCont = document.getElementById("sensors-form") as HTMLDivElement;
        this.brokerCont = document.getElementById("broker-container") as HTMLDivElement;
        this.calibrationDialog = document.getElementById("calibration-dialog") as HTMLDialogElement;
        const sensorsTemplateContent = document.getElementById("sensors-template")!.innerHTML;
        this.sensorsTemplate = Handlebars.compile(sensorsTemplateContent);
        const brokerTemplateContent = document.getElementById("broker-template")!.innerHTML;
        this.brokerTemplate = Handlebars.compile(brokerTemplateContent);
        this.calibrationTemplate = Handlebars.compile(document.getElementById("calibration-template")!.innerHTML)

        this.viewSwitchButton.onclick = () => this.switchView();
    }

    public start() {
        this.readMqttConfig()
            .then(
                () => {
                    return this.readConfig();
                }
            )
            .then(() => {
                if (!this.currentConfig) {
                    throw new Error('Config required!');
                }
                this.renderSensorsConfigForm(this.currentConfig['sensors-config']);

                return this.createGraph(this.currentConfig['sensors-config']);

            }).then(() => this.startTemperatureRead());
    }

    public updateBrokerConfig() {
        const form = document.getElementById("broker-config-form") as HTMLFormElement;
        const data = new FormData(form);
        const brokerConfig: IMqttConfig = {
            broker_host: data.get("broker_host") as string,
            broker_port: parseInt(data.get("broker_port") as string),
            keepalive: parseInt(data.get("keepalive") as string),
            topic: data.get("topic") as string,
            client_name: data.get("client_name") as string,
            user: data.get("user") as string,
            password: data.get("password") as string,
        };
        return this.runTask(() => {
                return fetch('/api/mqtt_config', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(brokerConfig)
                    }
                )
                    .then((response) => response.json())
                    .then((data: IMqttConfig) => {
                        this.renderBrokerConfigForm(data);
                        return data;
                    });
            }
        );
    }

    public updateConfigUI() {
        if (!this.currentConfig) {
            throw new Error('Config required!');
        }
        const form = document.getElementById("update-config-form") as HTMLFormElement;
        const data = new FormData(form);

        const sids: string[] = data.getAll('sid') as string[];
        const formNames: string[] = data.getAll('name') as string[];
        const formFields: string[] = data.getAll('field') as string[];
        const formColors: string[] = data.getAll('color') as string[];
        const formCals: string[] = data.getAll('cal') as string[];

        const nextConfig: ISensorsHash = JSON.parse(JSON.stringify(this.currentConfig["sensors-config"]));
        sids.forEach((sid, formIndex) => {
            nextConfig[sid].name = formNames[formIndex];
            nextConfig[sid].field = formFields[formIndex];
            nextConfig[sid].color = formColors[formIndex];
            nextConfig[sid].cal = parseFloat(formCals[formIndex]);
        });
        return this.updateConfigInternal(nextConfig);
    }

    private startTemperatureRead() {
        return this.runTask(() => {
            const sp = new URLSearchParams();
            sp.set("type", this.viewState === "EMA" ? "ema" : "raw");
            return fetch(`/api/temperature?${sp.toString()}`)
                .then((response) => response.json())
                .then((data) => {
                    if (!this.currentConfig) {
                        throw new Error('Config required!');
                    }
                    const time = new Date((data[0] + this.currentConfig["time-correction"]) * 1000);
                    const yUpdate = [];
                    const xUpdate = [];
                    const chartUpdate: number[] = [];
                    for (let odx = 1; odx < data.length; odx++) {
                        const sid = data[odx][0];
                        const chartInd = this.currentConfig['sensors-config'][sid].chartInd;
                        if (chartInd == null) {
                            continue;
                        }
                        chartUpdate.push(chartInd);
                        yUpdate.push([data[odx][1]]);
                        xUpdate.push([time]);
                    }
                    Plotly.extendTraces(this.chartDiv, {y: yUpdate, x: xUpdate}, chartUpdate);
                })
                .catch((e) => {
                    console.error('readTemperature', e);
                });
        }).then(() => setTimeout(() => this.startTemperatureRead(), 1000));
    }

    private readConfig() {
        return this.runTask(() => {
            return fetch('/api/config')
                .then((response) => response.json())
                .then((data) => {
                    this.currentConfig = data;
                    return data;
                })
                .catch((e) => {
                    console.error('Can not read config', e)
                });
        });
    }

    private readMqttConfig() {
        return this.runTask(() => {
            return fetch('/api/mqtt_config')
                .then((response) => response.json())
                .then((data: IMqttConfig) => {
                    this.renderBrokerConfigForm(data);
                    return data;
                })
                .catch((e) => {
                    console.error('Can not Mqtt read config', e)
                });
        });
    }

    private randomColor(modPart: number): string {
        const maxColor = 16777215;
        modPart = modPart % 3;
        const part = modPart * (maxColor / 3)
        let color = Math.floor(part + Math.random() * maxColor / 3).toString(16);
        while (color.length < 6) {
            color = '0' + color;
        }
        return '#' + color;
    }

    private runTask<T>(task: () => Promise<T>): Promise<unknown> {
        this.currentTask = this.currentTask.then(() => task(), () => task());
        return this.currentTask;
    }


    private renderSensorsConfigForm(sensor_config: ISensorsHash) {
        const sensors = Object.entries(sensor_config)
            .map(([sid, config]) => {
                return {
                    sid: sid,
                    add: config['add_str'],
                    name: config['name'],
                    field: config['field'],
                    color: config['color'],
                    cal: config['cal']
                }
            });
        this.sensorsCont.innerHTML = this.sensorsTemplate({sensors});
    }

    private renderBrokerConfigForm(brokerConfig: IMqttConfig) {
        this.brokerCont.innerHTML = this.brokerTemplate((brokerConfig));
    }

    private switchView() {
        return this.runTask(() => {
            if (!this.currentConfig) {
                return Promise.resolve();
            }
            this.viewState = this.viewState === "EMA" ? "CALIBRATION" : "EMA";
            switch (this.viewState) {
                case "EMA":
                    this.viewSwitchButton.innerHTML = "Show Calibration Data";
                    this.viewSwitchButton.classList.remove("secondary");
                    break;
                case "CALIBRATION":
                    this.viewSwitchButton.innerHTML = "Show EMA Data";
                    this.viewSwitchButton.classList.add("secondary");
                    break;
            }

            Plotly.purge(this.chartDiv);
            return this.createGraph(this.currentConfig['sensors-config']);
        });
    }

    private updateConfigInternal(nextConfig: ISensorsHash) {
        Object.values(nextConfig).forEach((v) => {
            v.addr = '';
            v.add_str = '';
        });
        return this.runTask(() => {
            return fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(nextConfig)
            })
                .then((response) => response.json())
                .then((data: IBoardConfig) => {
                    const oldConfig = this.currentConfig?.["sensors-config"] ?? {};
                    Object.entries(data["sensors-config"]).forEach(([k, c]) => {
                        c.chartInd = oldConfig[k]?.chartInd;
                    })
                    this.currentConfig = data;
                    if (this.currentConfig) {
                        Object.entries(this.currentConfig["sensors-config"])
                    }
                    this.renderSensorsConfigForm(data["sensors-config"]);
                    return data;
                })
                .catch((e) => {
                    console.error('Can not read config', e)
                });
        });
    }


    private createGraph(sensorsConfig: ISensorsHash): Promise<void> {
        const entries = Object.entries(sensorsConfig);
        const plotlyLines = [];
        for (let charIdx = 0; charIdx < entries.length; charIdx++) {
            const [, sensorConfig] = entries[charIdx];
            const lineColor = sensorConfig['color'] ?? this.randomColor(charIdx);
            sensorConfig['color'] = lineColor;
            sensorConfig['chartInd'] = charIdx;
            plotlyLines.push({
                x: [],
                y: [],
                mode: 'lines',
                line: {color: lineColor}
            });
        }
        return Plotly.newPlot(this.chartDiv, plotlyLines, {dragmode: 'select'})
            .then((pe) => {
                if (this.viewState !== 'CALIBRATION'){
                    return;
                }
                pe.on("plotly_selected", (data) => {
                    if (!(data?.range) || !this.currentConfig) {
                        return;
                    }
                    const oldConfig = this.currentConfig["sensors-config"];
                    const [min, max] = (data.range.x as unknown as string[]).map((ds: string) => new Date(ds));

                    const currentData = (pe as any).data as PlotData[];
                    let allValues: number[] = [];
                    const indexMeans: Map<number, number> = new Map<number, number>();
                    currentData.forEach((d, index) => {
                        const dx: Date[] = d.x as Date[];
                        const dy: number[] = d.y as number[]
                        const sorted = dx.map((date, i) => ({date, val: dy[i]}))
                            .filter(({date}) => {
                                return date >= min && date <= max;
                            })
                            .map(({val}) => val)
                            .sort();
                        allValues.push(...sorted);
                        const indexMean = sorted[Math.trunc(sorted.length / 2)];
                        indexMeans.set(index, indexMean);
                    });
                    allValues = allValues.sort();
                    const globalMean = allValues[Math.trunc(allValues.length / 2)];
                    const sensorCalibrations: Array<{ value: number, color?: string, sid: string }> = [];
                    indexMeans.forEach((indexMean, chartInd) => {
                        const configData = Object.entries(oldConfig).find(([, v]) => {
                            return v.chartInd == chartInd;
                        });
                        if (configData) {
                            const value = parseFloat((globalMean - indexMean).toFixed(2));
                            sensorCalibrations.push({value, color: configData[1].color, sid: configData[0]});
                        }
                    });

                    this.calibrationDialog.innerHTML = this.calibrationTemplate(({sensors: sensorCalibrations}));
                    this.calibrationDialog.showModal();
                    this.calibrationDialog.onclose = () => {
                        if (this.calibrationDialog.returnValue === "ok") {
                            const nextConfig: ISensorsHash = JSON.parse(JSON.stringify(oldConfig));
                            Object.entries(nextConfig).forEach(([sid, sc]) => {
                                const newCalibration = sensorCalibrations.find((s) => s.sid == sid)?.value;
                                if (newCalibration != null) {
                                    sc.cal = newCalibration;
                                }
                            });
                            this.updateConfigInternal(nextConfig)
                                .then(() => this.switchView());
                        }
                    };
                });
            });
    }
}