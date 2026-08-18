// 建物の3D表現(LOD1相当・単色の押し出しジオメトリ)。
// データは PLATEAU(国交省・CC BY 4.0)/OSM Buildings のいずれかを、あらかじめ
// tools/plateau-convert・tools/osm-buildings-convert で統一スキーマJSONに変換したものを使う:
//   { source, license, generatedAt, buildings: [{ footprint: [[lon,lat],...], height }] }
// footprintは経緯度のまま持ち、terrain.lonLatToWorld() で地形メッシュと同じ投影・原点に
// 変換することで、地形の頂点座標と完全に整合させる。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MATERIAL = new THREE.MeshLambertMaterial({ color: 0xb8b0a4 });

function emptyLayer() {
  return { group: new THREE.Group(), count: 0, setVisible() {}, dispose() {} };
}

// 2D多角形の符号付き面積(shoelace)。正=反時計回り
function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

// footprint(経緯度の配列)を1棟分のExtrudeGeometryに変換する。
// 失敗(頂点不足など)時はnullを返す
function buildOneGeometry(footprint, height, terrain) {
  if (!Array.isArray(footprint) || footprint.length < 3) return null;

  const world = footprint.map(([lon, lat]) => terrain.lonLatToWorld(lon, lat));
  // GeoJSON形式は始点=終点で閉じていることが多いので、末尾の重複点を落とす
  if (world.length > 1) {
    const a = world[0], b = world[world.length - 1];
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6) world.pop();
  }
  if (world.length < 3) return null;

  const cx = world.reduce((s, p) => s + p.x, 0) / world.length;
  const cz = world.reduce((s, p) => s + p.z, 0) / world.length;

  // 読み込み済み地形範囲の外にある建物は(地面が無いので)描かない
  const half = terrain.sizeMeters / 2;
  if (Math.abs(cx) > half || Math.abs(cz) > half) return null;

  // Shapeの(x,y)は (東西オフセット, -南北オフセット) に対応させる。
  // ExtrudeGeometryをrotateX(-90°)で立てたときにワールドXZと向きが一致するようにするため
  let pts2d = world.map((p) => [p.x - cx, -(p.z - cz)]);
  if (signedArea(pts2d) < 0) pts2d = pts2d.reverse(); // ExtrudeGeometryはCCW前提

  const h = Number.isFinite(height) && height > 0 ? height : 6;
  const shape = new THREE.Shape(pts2d.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);

  const groundY = terrain.getHeight(cx, cz);
  geo.translate(cx, groundY, cz);
  geo.deleteAttribute('uv');
  return geo;
}

// areaId: PRESET_AREASの id。データが無い/取得失敗なら建物0棟の空レイヤーを返す(フェイルセーフ)
export async function buildBuildings(areaId, terrain, onProgress) {
  if (!areaId) return emptyLayer();

  let data;
  try {
    const res = await fetch(`./data/buildings/${areaId}.json`);
    if (!res.ok) return emptyLayer();
    data = await res.json();
  } catch {
    return emptyLayer();
  }

  const list = Array.isArray(data?.buildings) ? data.buildings : [];
  const geometries = [];
  const total = list.length;
  for (let i = 0; i < list.length; i++) {
    try {
      const geo = buildOneGeometry(list[i].footprint, list[i].height, terrain);
      if (geo) geometries.push(geo);
    } catch {
      // 個々の建物データが壊れていても他の建物の描画は継続する
    }
    if (onProgress) onProgress(i + 1, total);
  }

  if (geometries.length === 0) return emptyLayer();

  const merged = mergeGeometries(geometries, false);
  for (const geo of geometries) geo.dispose();

  const mesh = new THREE.Mesh(merged, MATERIAL);
  const group = new THREE.Group();
  group.add(mesh);

  return {
    group,
    count: geometries.length,
    setVisible(v) { group.visible = v; },
    dispose() {
      merged.dispose();
      group.clear();
    },
  };
}
