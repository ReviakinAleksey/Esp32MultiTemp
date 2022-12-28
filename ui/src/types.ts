import {type extendTraces, newPlot, purge, update} from 'plotly.js'

export const Plotly: {
    newPlot: typeof newPlot,
    extendTraces: typeof extendTraces,
    update: typeof update,
    purge: typeof purge
} = window['Plotly'];


export interface ISensorConfig {
    addr: string;
    add_str: string;
    cal: number;
    field?: string;
    name?: string;
    color?: string;
    chartInd?: number;
}

export interface ISensorsHash {
    [key: string]: ISensorConfig
}

export interface IBoardConfig {
    'sensors-config': ISensorsHash;
    'time-correction': number
}


export interface IMqttConfig {
    "client_name": string;
    "broker_host": string;
    "broker_port": number;
    "user": string;
    "password": string;
    "keepalive": number;
    "topic": string;
}