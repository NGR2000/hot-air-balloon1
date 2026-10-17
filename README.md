# 熱気球フライトゲーム(プロトタイプ)

国土地理院の地形データを使い、実在の日本の地形を3D化した空間で熱気球を操縦するフライトゲーム。
JDG(ジャッジ・ディクレアード・ゴール)競技のミニマムな一周が遊べるプロトタイプです。

仕様の検討経緯は [仕様検討メモ.md](./仕様検討メモ.md) を参照してください。

## ライセンス・ご利用について / License

このリポジトリのソースコードは、内容を見ていただくために公開しています。**オープンソースではありません。**

- 閲覧、および個人での学習・検証のための動作確認は自由です
- 複製・改変したものの配布・公開・ホスティング、商用利用には、事前の許可が必要です
- 「熱気球フライト」「Hot Air Balloon Flight Simulator」の名称・ロゴ・キャラクターは使用できません
- 地図・建物データや外部ライブラリは、それぞれのライセンスに従います(出典はゲーム内のⓘに表示)

詳しくは [LICENSE](./LICENSE) をご覧ください。利用の許可・お問い合わせ: hotairballoonflight.support@gmail.com

The source code in this repository is published so that people can read it. **It is not open source.**
Viewing and personal, non-commercial evaluation are allowed; redistribution, hosting, modified
versions and commercial use require prior permission. The names "熱気球フライト" /
"Hot Air Balloon Flight Simulator", logos and characters may not be used. Third-party data and
libraries are subject to their own licenses. See [LICENSE](./LICENSE) for details.

### サポーター版について / Supporter Edition

世界各地のフライトエリアや観客モードなどを収録した有料の「サポーター版」は別の製品で、
このリポジトリには含まれていません。ご案内: https://hot-air-balloon-site.pages.dev/support/

The paid Supporter Edition (flight areas around the world, Spectator Mode and more) is a separate
product and is not included in this repository. Details: https://hot-air-balloon-site.pages.dev/en/support/

## 遊び方(ブラウザで開くだけ)

インストール不要。以下のURLを開くだけで遊べます(GitHub Pages)。

**PC版**: https://rhitomigm-hash.github.io/hot-air-balloon1/prototype/

**スマホ版**(タッチ操作対応): https://rhitomigm-hash.github.io/hot-air-balloon1/mobile/

## ローカルで動かす場合

ビルド不要。ローカルで静的ファイルを配信して `prototype/index.html` を開くだけです。

```powershell
python -m http.server 8000 --directory .
```

ブラウザで `http://localhost:8000/prototype/` を開いてください。

### 操作

- `Space` 長押し: バーナー
- `R` 長押し: リップライン(排気)
- `M`: マーカー投下
- `V`: 視点切替(ゴンドラ/外部)
- `1`〜`4`: 時間加速 ×1/×2/×4/×8
- `P`: パイバル表 表示/非表示
- マウスドラッグ: 視点回転 / ホイール: ズーム

## 構成

- `prototype/index.html` — 画面・UI
- `prototype/main.js` — ゲームロジック(物理・風・競技フロー・エリア/風の共有URL)
- `prototype/terrain.js` — 地理院タイルからの地形生成(標高DEM+航空写真、LOD)

出典: 国土地理院 地理院タイル(標高タイル・全国最新写真・標準地図)
