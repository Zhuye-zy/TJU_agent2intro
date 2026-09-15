// Tour stop photo registry. Real licensed photos are registered here by poi_id;
// unreferenced stops keep a clearly marked placeholder slot until data arrives.
export interface TourPhoto {
  src: string;
  caption: string;
  creator?: string | null;
  license?: string | null;
  sourceUrl?: string | null;
  placeholder?: boolean;
}

const PHOTOS: Record<string, TourPhoto> = {
  // Example entry once an authorized photo is available:
  // 'weijinlu-09-teaching': {
  //   src: '/assets/campus/photos/weijinlu-09-teaching.jpg',
  //   caption: '第九教学楼',
  //   creator: '摄影者署名',
  //   license: '使用依据',
  //   sourceUrl: 'https://…',
  // },
};

function placeholderImage(title: string): string {
  const safe = title.replace(/[<>&"']/g, '').slice(0, 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">`
    + `<rect width="640" height="400" fill="#e9f0ea"/>`
    + `<rect x="24" y="24" width="592" height="352" rx="16" fill="#f7faf7" stroke="#c9d8cc" stroke-dasharray="10 8"/>`
    + `<circle cx="320" cy="168" r="46" fill="none" stroke="#9db8a6" stroke-width="6"/>`
    + `<path d="M298 180l16-22 14 16 12-14 20 26z" fill="#9db8a6"/>`
    + `<circle cx="306" cy="152" r="7" fill="#9db8a6"/>`
    + `<text x="320" y="258" text-anchor="middle" font-family="Noto Sans SC, Microsoft YaHei, sans-serif" font-size="30" fill="#41604f">${safe}</text>`
    + `<text x="320" y="300" text-anchor="middle" font-family="Noto Sans SC, Microsoft YaHei, sans-serif" font-size="18" fill="#7d9486">实景图待补充 · 点击查看预留位</text>`
    + `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function tourPhotoFor(poiId: string, title: string): TourPhoto {
  const photo = PHOTOS[poiId];
  if (photo && photo.src) return photo;
  return { src: placeholderImage(title), caption: title, placeholder: true };
}
