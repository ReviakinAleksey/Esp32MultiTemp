export class WifiManagerUi {

    private currentTask: Promise<unknown> = Promise.resolve();

    public start() {
        console.log('Starting');
        setInterval(() => this.readNetworkList(), 500);
    }


    private readNetworkList() {
        return this.runTask(() => {
            return fetch('/api/networks')
                .then((response) => response.json())
                .then((data: unknown) => {
                    console.log('Data', data);
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