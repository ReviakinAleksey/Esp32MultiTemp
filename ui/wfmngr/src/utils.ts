export namespace UiUtils {
    export function mean(data: number[]): number {
        return data.reduce((a, b) => a + b, 0) / data.length;
    }

    export function findByIdStrict<T extends  HTMLElement>(id: string): T {
        const option = document.getElementById(id);
        if (! option){
            throw new Error(`Element with ID: ${id} not found on page`);
        }
        return option as T;
    }
}