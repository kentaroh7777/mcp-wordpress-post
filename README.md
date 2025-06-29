# MCP WordPress Post Server

WordPress投稿管理に特化した**ファイルパス方式画像アップロード機能**を持つMCP（Model Context Protocol）サーバーです。

本プロジェクトは[@prathammanocha](https://github.com/prathammanocha)氏の優秀な[wordpress-mcp-server](https://github.com/prathammanocha/wordpress-mcp-server)をベースに、画像処理機能を大幅に改善したものです。

## ✨ 主な機能

### 🖼️ **高度な画像アップロードシステム**
- **ファイルパス方式**: ファイルシステムへの直接アクセス（Base64エンコード不要）
- **大容量ファイル対応**: WordPressの制限内でデータ損失なしに処理
- **multipart/form-data**: WordPress標準メディアアップロードAPI使用
- **自動最適化**: WordPress内蔵画像処理機能を活用
- **レスポンシブ画像**: 異なる画面サイズ用のsrcsetを自動生成

### 📝 **投稿管理機能**
- **投稿作成**: 複数画像添付対応
- **投稿更新**: 既存投稿の編集
- **投稿一覧**: ページネーション対応
- **投稿詳細取得**: フルコンテンツ表示
- **下書き/公開ワークフロー**: ステータス管理

### 🔧 **技術的改善点**
- **メモリ使用量33%削減**: Base64エンコードの排除
- **データ整合性**: Base64方式で発生していた95-98%のデータ損失を解決
- **エラーハンドリング**: ファイル存在確認やアップロード検証の充実
- **デバッグログ**: トラブルシューティング用の詳細ログ

## 🚀 クイックスタート

### 前提条件
- Node.js v18以上
- REST API有効なWordPressサイト
- WordPressアプリケーションパスワード

### インストール

1. **リポジトリのクローン**:
```bash
git clone [your-repo-url]
cd mcp-wordpress-post
```

2. **依存関係のインストール**:
```bash
npm install
```

3. **環境設定**:
```bash
cp .env.example .env
# .envファイルを編集してWordPressの認証情報を設定
```

4. **ビルド**:
```bash
npm run build
```

5. **サーバー起動**:
```bash
npm start
```

## 📖 使用方法

### MCP設定

MCPクライアントの設定ファイルに追加してください：

```json
{
  "mcpServers": {
    "wordpress-post": {
      "command": "node",
      "args": ["/path/to/mcp-wordpress-post/build/posts-only.js"]
    }
  }
}
```

### 画像付き投稿の作成

改善された画像アップロードシステムでは**ファイルパス**を使用します：

```javascript
// 新しいファイルパス方式（推奨）
{
  "tool": "create-post",
  "title": "画像付きの投稿",
  "content": "この画像をご覧ください: {IMAGE1}",
  "images": [{
    "filePath": "/絶対パス/to/image.png",
    "filename": "カスタム名.png", // 省略可能
    "placeholder": "{IMAGE1}"
  }]
}
```

### 利用可能なツール

#### `create-post`
画像添付対応の新規WordPress投稿作成

**パラメータ:**
- `siteUrl` (文字列): WordPressサイトURL
- `username` (文字列): WordPressユーザー名  
- `password` (文字列): アプリケーションパスワード
- `title` (文字列): 投稿タイトル
- `content` (文字列): 画像プレースホルダーを含む投稿内容
- `status` (列挙型): `"draft"` | `"publish"` | `"private"` (デフォルト: `"draft"`)
- `images` (配列, 省略可能): `filePath`、`placeholder`、省略可能な`filename`を持つ画像オブジェクト

#### `list-posts`
ページネーション対応でWordPress投稿を取得

#### `get-post`
特定の投稿の詳細情報を取得

#### `update-post`
既存のWordPress投稿を更新

## 🔄 Base64方式からの移行

Base64ベースのシステムから移行する場合：

### 従来方式（Base64 - 非推奨）:
```javascript
images: [{
  data: "iVBORw0KGgoAAAANSUhEUgAAAAE...", // 大きなBase64文字列
  filename: "image.png",
  placeholder: "{IMAGE1}"
}]
```

### 新方式（ファイルパス - 現在）:
```javascript
images: [{
  filePath: "/path/to/image.png",              // ファイルシステムパス
  filename: "カスタム名.png",                  // 省略可能なカスタム名
  placeholder: "{IMAGE1}"
}]
```

## 🐛 トラブルシューティング

### よくある問題

1. **ファイルが見つからないエラー**:
   - ファイルパスが絶対パスであることを確認
   - ファイルのアクセス権限を確認

2. **大容量ファイルのアップロード失敗**:
   - WordPressの`upload_max_filesize`設定を確認
   - `post_max_size`と`memory_limit`を確認

3. **画像が表示されない**:
   - プレースホルダーの形式が正確に一致していることを確認
   - `/tmp/mcp-debug.log`のデバッグログを確認

### デバッグモード

詳細ログを有効にする：
```bash
npm run debug-mcp
```

## 📊 パフォーマンス比較

| 項目 | Base64方式 | ファイルパス方式 |
|------|-----------|----------------|
| メモリ使用量 | 高い (+33%) | 効率的 |
| データ損失 | 大容量ファイルで95-98% | 0% |
| 処理速度 | 遅い | 高速 |
| ファイルサイズ制限 | 実用的には~100KB | WordPress制限まで |

## 🤝 貢献

このプロジェクトは[prathammanocha/wordpress-mcp-server](https://github.com/prathammanocha/wordpress-mcp-server)の基盤の上に構築されています。

### 開発環境セットアップ

1. **サブモジュール付きクローン**:
```bash
git clone --recursive [your-repo-url]
```

2. **依存関係のインストール**:
```bash
npm install
```

3. **開発モード**:
```bash
npm run dev
```

### テスト

機能をテストするためのデバッグスクリプトを実行：
```bash
npm run debug-playwright  # WordPress統合テスト
npm run debug-mcp        # MCPサーバーテスト
```

## 📊 解決された問題

### Base64方式の問題点
- **98%のデータ損失**: 85KB → 1.5KB という深刻な問題
- **メモリ効率の悪さ**: 33%の無駄なメモリ使用
- **処理速度の低下**: エンコード/デコード処理のオーバーヘッド

### ファイルパス方式の利点
- **データ損失ゼロ**: 85KB → 50KB（正常な最適化）
- **メモリ効率**: Base64エンコード処理の排除
- **高速処理**: ファイル直接読み取りによる高速化
- **安定性**: WordPress標準API使用による安定動作

## 📄 ライセンス

MIT License - 詳細はLICENSEファイルを参照してください。

## 🙏 謝辞

- [**@prathammanocha**](https://github.com/prathammanocha) - オリジナルの[wordpress-mcp-server](https://github.com/prathammanocha/wordpress-mcp-server)
- WordPress REST API チーム - 優秀なドキュメント
- Model Context Protocol 仕様作成者

## 🔗 関連プロジェクト

- **オリジナルサーバー**: [prathammanocha/wordpress-mcp-server](https://github.com/prathammanocha/wordpress-mcp-server)
- **MCP SDK**: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)

---

**より良いWordPress自動化のために ❤️ で作成** 