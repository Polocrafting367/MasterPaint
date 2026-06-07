self.importScripts('../WasmManager.js');

self.onmessage = async function (e) {
    const {
        data,
        width,
        height,
        startX,
        startY,
        tolerance,
        mode,
        requestId,
        wasmEnabled
    } = e.data;

    if (!data || !width || !height) {
        self.postMessage({ error: 'Missing parameters', requestId });
        return;
    }

    if (typeof MasterPaintWasm !== 'undefined' && wasmEnabled) {
        if (!MasterPaintWasm.isLoaded) await MasterPaintWasm.init();
        if (MasterPaintWasm.isLoaded) {
            let mask;
            const startIdx = (startY * width + startX) * 4;
            const sr = data[startIdx];
            const sg = data[startIdx + 1];
            const sb = data[startIdx + 2];
            const sa = data[startIdx + 3];

            if (mode === 'similar') {
                mask = MasterPaintWasm.similarColor(new ImageData(data, width, height), sr, sg, sb, sa, tolerance);
            } else {
                mask = MasterPaintWasm.magicWand(new ImageData(data, width, height), startX, startY, sr, sg, sb, sa, tolerance);
            }

            if (mask) {
                self.postMessage({ mask, requestId }, [mask.buffer]);
                return;
            }
        }
    }

    const mask = new Uint8Array(width * height);
    const startIdx = (startY * width + startX) * 4;
    const sr = data[startIdx];
    const sg = data[startIdx + 1];
    const sb = data[startIdx + 2];
    const sa = data[startIdx + 3];

    const tolSq = tolerance * tolerance;

    const match = (i) => {
        const dr = data[i] - sr;
        const dg = data[i + 1] - sg;
        const db = data[i + 2] - sb;
        const da = data[i + 3] - sa;
        return (dr * dr + dg * dg + db * db + da * da) <= tolSq;
    };

    if (mode === 'similar') {
        for (let i = 0; i < width * height; i++) {
            if (match(i * 4)) {
                mask[i] = 1;
            }
        }
    } else {
        // Contiguous (Flood Fill)
        const visited = new Uint8Array(width * height);
        const stack = [[startX, startY]];
        visited[startY * width + startX] = 1;
        mask[startY * width + startX] = 1;

        while (stack.length > 0) {
            const [x, y] = stack.pop();

            const neighbors = [
                [x + 1, y], [x - 1, y],
                [x, y + 1], [x, y - 1]
            ];

            for (let i = 0; i < neighbors.length; i++) {
                const nx = neighbors[i][0];
                const ny = neighbors[i][1];

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const vi = ny * width + nx;
                    if (!visited[vi]) {
                        visited[vi] = 1;
                        if (match(vi * 4)) {
                            mask[vi] = 1;
                            stack.push([nx, ny]);
                        }
                    }
                }
            }
        }
    }

    self.postMessage({
        mask,
        requestId
    }, [mask.buffer]);
};
