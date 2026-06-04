    function applySharpen(data, width, height, amount, isFloat = false) {
        const out = new (isFloat ? Float32Array : Uint8ClampedArray)(data.length);
        const k = amount / 150;
        const c = 1 + 4 * k;
        const n = -k;

        out.set(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;
                const up = i - width * 4;
                const dn = i + width * 4;
                const lf = i - 4;
                const rt = i + 4;

                let res = data[i] * c + (data[up] + data[dn] + data[lf] + data[rt]) * n;
                out[i] = isFloat ? res : (res < 0 ? 0 : (res > 255 ? 255 : res));

                res = data[i + 1] * c + (data[up + 1] + data[dn + 1] + data[lf + 1] + data[rt + 1]) * n;
                out[i + 1] = isFloat ? res : (res < 0 ? 0 : (res > 255 ? 255 : res));

                res = data[i + 2] * c + (data[up + 2] + data[dn + 2] + data[lf + 2] + data[rt + 2]) * n;
                out[i + 2] = isFloat ? res : (res < 0 ? 0 : (res > 255 ? 255 : res));
                
                if (isFloat) out[i + 3] = data[i + 3];
            }
        }
        return out;
    }
