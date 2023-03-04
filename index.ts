import * as fs from 'fs';
import { fetch, Request } from 'undici';
import mbgl from '@maplibre/maplibre-gl-native';
import sharp from 'sharp';

async function render({
  center,
  zoom,
  width,
  height,
}: {
  center: [number, number];
  zoom: number;
  width: number;
  height: number;
}) {
  return new Promise<Buffer>(async (resolve, reject) => {
    const options: mbgl.MapOptions = {
      request: async ({ url }, callback) => {
        try {
          const request = new Request(url);
          request.headers.set('accept-encoding', 'gzip');
          const response = await fetch(request);

          if (response.status === 200) {
            const result: mbgl.RequestResponse = {
              data: Buffer.from(await response.arrayBuffer()),
            };

            if (response.headers.has('modified')) result.modified = new Date(response.headers.get('modified')!);
            if (response.headers.has('expires')) result.expires = new Date(response.headers.get('expires')!);
            if (response.headers.has('etag')) result.etag = response.headers.get('etag')!;

            callback(undefined, result);
          } else if (response.status === 404) {
            // Some tiles might be missing...
            callback();
          } else {
            callback(new Error('Request failed: ' + response.status + ' ' + response.statusText));
          }
        } catch (error: any) {
          callback(error);
        }
      },
    };

    const map = new mbgl.Map(options);
    map.load(await (await fetch('https://demotiles.maplibre.org/style.json')).json());

    map.setBearing(45);

    map.render(
      {
        width,
        height,
        zoom,
        center,
      },
      (err, buffer) => {
        map.release();

        if (err) {
          reject(err);
        } else {
          const image = sharp(buffer, {
            raw: {
              width,
              height,
              channels: 4,
            },
          });

          resolve(image.toFormat('jpg').toBuffer());
        }
      },
    );
  });
}

try {
  const buffer = await render({
    center: [0, 0],
    zoom: 0,
    width: 512,
    height: 512,
  });

  fs.writeFileSync('test.jpg', buffer);
  console.log('Image hase been rendered successfully');
} catch (error: any) {
  console.error('message' in error ? error.message : error);
}
