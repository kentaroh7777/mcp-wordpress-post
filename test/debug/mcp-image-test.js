import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function testMCPImageUpload() {
  console.log('🔍 MCP画像アップロード詳細テスト開始...');
  
  // テスト用画像データを複数パターン作成
  const testImages = {
    'small-png': {
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8/5+hnoEIwDiqkL4KAcT9GO2HLscYAAAAAElFTkSuQmCC',
      filename: 'test-10x10.png',
      placeholder: '{TEST_PNG}'
    },
    'jpeg-simple': {
      data: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      filename: 'test-2x2.jpg',
      placeholder: '{TEST_JPEG}'
    }
  };
  
  // 各画像パターンでテスト
  for (const [type, imageData] of Object.entries(testImages)) {
    console.log(`\n📷 テスト: ${type}`);
    
    try {
      // MCP投稿作成APIを模擬（実際のAPIコールのシミュレーション）
      const postData = {
        title: `【詳細テスト】${type} 画像アップロード`,
        content: `${type}形式の画像テスト:\n\n${imageData.placeholder}\n\n画像が表示されるかテスト中...`,
        status: 'draft',
        images: [imageData]
      };
      
      console.log(`📝 投稿データ準備完了:`);
      console.log(`   - タイトル: ${postData.title}`);
      console.log(`   - 画像ファイル: ${imageData.filename}`);
      console.log(`   - データサイズ: ${imageData.data.length} chars`);
      console.log(`   - プレースホルダー: ${imageData.placeholder}`);
      
      // Base64データの妥当性チェック
      try {
        const buffer = Buffer.from(imageData.data, 'base64');
        console.log(`   ✅ Base64デコード成功: ${buffer.length} bytes`);
        
        // 画像ファイルとして一時保存してヘッダー確認
        const tempPath = `/tmp/debug-${imageData.filename}`;
        fs.writeFileSync(tempPath, buffer);
        
        // ファイルヘッダーをチェック
        const header = buffer.slice(0, 8);
        const headerHex = header.toString('hex');
        console.log(`   📊 ファイルヘッダー: ${headerHex}`);
        
        // 画像形式の判定
        if (headerHex.startsWith('89504e47')) {
          console.log('   🎨 PNG形式として認識');
        } else if (headerHex.startsWith('ffd8ff')) {
          console.log('   🎨 JPEG形式として認識');
        } else {
          console.log('   ⚠️ 不明な画像形式');
        }
        
      } catch (decodeError) {
        console.log(`   ❌ Base64デコードエラー: ${decodeError.message}`);
      }
      
    } catch (error) {
      console.log(`❌ ${type}テストでエラー: ${error.message}`);
    }
  }
  
  // プレースホルダー置換ロジックの問題を調査
  console.log('\n🔍 プレースホルダー置換ロジック調査...');
  const testContent = 'テスト画像: {TEST_IMAGE} ここに表示されるはず';
  const placeholder = '{TEST_IMAGE}';
  const replacement = '<img src="https://example.com/test.png" alt="テスト画像" />';
  
  console.log(`📝 元のコンテンツ: ${testContent}`);
  console.log(`🔄 プレースホルダー: ${placeholder}`);
  console.log(`📷 置換後の内容: ${replacement}`);
  
  const replacedContent = testContent.replace(placeholder, replacement);
  console.log(`✅ 置換結果: ${replacedContent}`);
  
  if (replacedContent === testContent) {
    console.log('❌ プレースホルダーが置換されていません！');
  } else {
    console.log('✅ プレースホルダー置換は正常に動作します');
  }
}

// 実行
testMCPImageUpload().catch(console.error); 