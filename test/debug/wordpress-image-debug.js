import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function debugWordPressImages() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // スローモーションで実行
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('🔍 WordPress画像アップロードデバッグを開始...');
    
    // デバッグ用スクリーンショット保存ディレクトリ
    const screenshotDir = '/tmp/wordpress-debug-screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // 1. WordPress管理画面にログイン
    console.log('📝 Step 1: WordPress管理画面にログイン');
    await page.goto('https://h-fpo.com/ESt2Vo5UPZ/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/01-login-page.png` });
    
    // ログイン情報を入力
    console.log('🔑 ログイン情報を入力中...');
    
    const wpUsername = process.env.WORDPRESS_USERNAME;
    const wpPassword = process.env.WORDPRESS_PASSWORD;
    
    if (!wpUsername || !wpPassword) {
      throw new Error('環境変数 WORDPRESS_USERNAME と WORDPRESS_PASSWORD を設定してください');
    }
    
    // ユーザー名フィールドを探して入力
    const userField = await page.locator('#user_login, input[name="log"], input[type="text"]:first-of-type').first();
    await userField.fill(wpUsername);
    console.log('✅ ユーザー名を入力');
    
    // パスワードフィールドを探して入力
    const passField = await page.locator('#user_pass, input[name="pwd"], input[type="password"]').first();
    await passField.fill(wpPassword);
    console.log('✅ パスワードを入力');
    
    await page.screenshot({ path: `${screenshotDir}/01-login-filled.png` });
    
    // ログインボタンをクリック
    const submitButton = await page.locator('#wp-submit, input[type="submit"], button[type="submit"]').first();
    await submitButton.click();
    console.log('🚀 ログインボタンをクリックしました');
    
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/02-dashboard.png` });
    
    // 2. メディアライブラリを確認
    console.log('📁 Step 2: メディアライブラリ確認');
    await page.goto('https://h-fpo.com/wp-admin/upload.php');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/03-media-library.png` });
    
    // 最近アップロードされた画像を確認
    const mediaItems = await page.$$('.attachment');
    console.log(`📊 メディアライブラリのアイテム数: ${mediaItems.length}`);
    
    // 3. テスト投稿を確認
    console.log('📄 Step 3: 作成したテスト投稿を確認');
    await page.goto('https://h-fpo.com/wp-admin/edit.php?post_status=draft');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/04-draft-posts.png` });
    
    // テスト投稿のタイトルを探して詳細を確認
    const testPostLinks = await page.$$('text=/.*画像テスト.*/');
    if (testPostLinks.length > 0) {
      console.log(`✅ テスト投稿が見つかりました: ${testPostLinks.length}件`);
      
      // 最新のテスト投稿を編集画面で開く
      await testPostLinks[0].click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${screenshotDir}/05-test-post-edit.png` });
      
      // エディタの内容を確認
      const editorContent = await page.textContent('.wp-editor-area, .block-editor, [data-title]');
      console.log('📝 投稿内容の一部:', editorContent?.substring(0, 200));
      
      // ブロックエディタの場合の画像ブロック確認
      const imageBlocks = await page.$$('.wp-block-image, .wp-block-media-text, img');
      console.log(`🖼️ 画像ブロック/要素数: ${imageBlocks.length}`);
      
      if (imageBlocks.length > 0) {
        for (let i = 0; i < imageBlocks.length; i++) {
          const imgSrc = await imageBlocks[i].getAttribute('src');
          console.log(`📷 画像${i + 1}: ${imgSrc}`);
        }
      }
    }
    
    // 4. WordPress REST APIエンドポイントを直接確認
    console.log('🔌 Step 4: MCP REST APIエンドポイント確認');
    await page.goto('https://h-fpo.com/?rest_route=/wp/v2/wpmcp');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/06-mcp-endpoint.png` });
    
    const mcpResponse = await page.textContent('body');
    console.log('🔌 MCP エンドポイントレスポンス:', mcpResponse?.substring(0, 200));
    
    // 5. プラグイン設定を確認
    console.log('🔧 Step 5: プラグイン設定確認');
    await page.goto('https://h-fpo.com/wp-admin/plugins.php');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/07-plugins.png` });
    
    // WordPress MCPプラグインが有効かチェック
    const mcpPlugin = await page.$('text=/.*WordPress MCP.*/');
    if (mcpPlugin) {
      console.log('✅ WordPress MCPプラグインが見つかりました');
      await mcpPlugin.screenshot({ path: `${screenshotDir}/08-mcp-plugin.png` });
    } else {
      console.log('❌ WordPress MCPプラグインが見つかりません');
    }
    
    // 6. メディア設定を確認
    console.log('⚙️ Step 6: メディア設定確認');
    await page.goto('https://h-fpo.com/wp-admin/options-media.php');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/09-media-settings.png` });
    
    // 7. 新規投稿で手動画像アップロードテスト
    console.log('📝 Step 7: 手動画像アップロードテスト');
    await page.goto('https://h-fpo.com/wp-admin/post-new.php');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/10-new-post.png` });
    
    // シンプルな画像ファイルを作成してアップロードテスト
    const testImagePath = '/tmp/test-upload.png';
    const testImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8/5+hnoEIwDiqkL4KAcT9GO2HLscYAAAAAElFTkSuQmCC', 'base64');
    fs.writeFileSync(testImagePath, testImageData);
    
    // メディアを追加ボタンを探してクリック
    const addMediaButton = await page.$('.insert-media, .editor-media-placeholder, [aria-label*="メディア"], [aria-label*="Media"]');
    if (addMediaButton) {
      await addMediaButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/11-media-modal.png` });
      
      // ファイルアップロード
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(testImagePath);
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${screenshotDir}/12-upload-progress.png` });
      }
    }
    
    console.log('✅ デバッグ完了！スクリーンショットを確認してください。');
    console.log(`📁 スクリーンショット保存先: ${screenshotDir}`);
    
  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生しました:', error);
    const errorScreenshotDir = '/tmp/wordpress-debug-screenshots';
    if (!fs.existsSync(errorScreenshotDir)) {
      fs.mkdirSync(errorScreenshotDir, { recursive: true });
    }
    await page.screenshot({ path: `${errorScreenshotDir}/error-${Date.now()}.png` });
  } finally {
    await browser.close();
  }
}

// 実行
debugWordPressImages().catch(console.error); 