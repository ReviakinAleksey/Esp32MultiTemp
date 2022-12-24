import {IBoardConfig, IMqttConfig, ISensorsHash, Plotly} from "./types";

export class UI {
    private chartDiv: string;
    private debugCont: HTMLDivElement;
    private sensorsCont: HTMLDivElement;
    private sensorsTemplate: HandlebarsTemplateDelegate<any>;

    private currentConfig: IBoardConfig | null = null;
    private currentMqttConfig: IMqttConfig | null = null;
    private currentTask: Promise<unknown> = Promise.resolve();

    constructor() {
        this.chartDiv = "chart";
        this.debugCont = document.getElementById("debug-cont") as HTMLDivElement;
        this.sensorsCont = document.getElementById("sensors-form") as HTMLDivElement;
        const sensorsTemplateContent = document.getElementById("sensors-template")!.innerHTML;
        this.sensorsTemplate = Handlebars.compile(sensorsTemplateContent);
    }

    public start() {
        this.readMqttConfig()
            .then(
                (mqttConfig) => {
                    this.debugCont.innerHTML = JSON.stringify(mqttConfig);
                    return this.readConfig();
                }
            )
            .then(() => {
                if (!this.currentConfig) {
                    throw new Error('Config required!');
                }
                const sensorsConfig = this.currentConfig['sensors-config'];
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
                Plotly.newPlot(this.chartDiv, plotlyLines);
                this.renderSensorsConfigForm(sensorsConfig);
                return this.startTemperatureRead();
            });
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
        console.log({sids, formNames, formFields, formColors, formCals});

        const nextConfig: ISensorsHash = JSON.parse(JSON.stringify(this.currentConfig["sensors-config"]));
        sids.forEach((sid, formIndex) => {
            nextConfig[sid].addr = '';
            nextConfig[sid].add_str = '';
            nextConfig[sid].name = formNames[formIndex];
            nextConfig[sid].field = formFields[formIndex];
            nextConfig[sid].color = formColors[formIndex];
            nextConfig[sid].cal = parseFloat(formCals[formIndex]);
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

    private startTemperatureRead() {
        return this.runTask(() => {
            return fetch('/api/temperature')
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
                .then((data) => {
                    this.currentMqttConfig = data;
                    return data;
                })
                .catch((e) => {
                    console.error('Can not read config', e)
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

}