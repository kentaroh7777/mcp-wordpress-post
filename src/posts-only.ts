#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import { appendFileSync, readFileSync, existsSync } from "fs";
import { basename, extname } from "path";
import FormData from "form-data";

// 環境変数からデフォルト設定を読み込み
const DEFAULT_SITE_URL = process.env.WORDPRESS_SITE_URL || '';
const DEFAULT_USERNAME = process.env.WORDPRESS_USERNAME || '';
const DEFAULT_PASSWORD = process.env.WORDPRESS_PASSWORD || '';

// ================ INTERFACES ================

interface WPPost {
  id: number;
  date?: string;
  date_gmt?: string;
  modified?: string;
  modified_gmt?: string;
  slug?: string;
  status?: 'publish' | 'future' | 'draft' | 'pending' | 'private';
  type?: string;
  link?: string;
  title?: {
    rendered: string;
  };
  content?: {
    rendered: string;
    protected?: boolean;
  };
  excerpt?: {
    rendered: string;
    protected?: boolean;
  };
  author?: number;
  featured_media?: number;
  comment_status?: 'open' | 'closed';
  ping_status?: 'open' | 'closed';
  sticky?: boolean;
  template?: string;
  format?: 'standard' | 'aside' | 'chat' | 'gallery' | 'link' | 'image' | 'quote' | 'status' | 'video' | 'audio';
  meta?: Record<string, any>;
  categories?: number[];
  tags?: number[];
}

// ================ SERVER SETUP ================

const server = new McpServer({
  name: "wordpress-posts",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Helper function for making WordPress API requests
async function makeWPRequest<T>({
  siteUrl, 
  endpoint,
  method = 'GET',
  auth,
  data = null,
  params = null
}: {
  siteUrl: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  auth: { username: string; password: string };
  data?: any;
  params?: any;
}): Promise<T> {
  const authString = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  
  try {
    const response = await axios({
      method,
      url: `${siteUrl}/wp-json/wp/v2/${endpoint}`,
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      data: data,
      params: params
    });
    
    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`WordPress API error: ${error.response.data?.message || error.message}`);
    }
    throw error;
  }
}

// ================ POST TOOLS ================

// List Posts
server.tool(
  "list-posts",
  "Get a list of WordPress posts",
  {
    siteUrl: z.string().url().default(DEFAULT_SITE_URL).describe("WordPress site URL (defaults to env WORDPRESS_SITE_URL)"),
    username: z.string().default(DEFAULT_USERNAME).describe("WordPress username (defaults to env WORDPRESS_USERNAME)"),
    password: z.string().default(DEFAULT_PASSWORD).describe("WordPress application password (defaults to env WORDPRESS_PASSWORD)"),
    page: z.number().min(1).optional().default(1).describe("Current page of the collection"),
    perPage: z.number().min(1).max(100).optional().default(10).describe("Maximum number of items to be returned"),
    search: z.string().optional().describe("Limit results to those matching a string"),
    status: z.array(z.enum(["publish", "future", "draft", "pending", "private"])).optional().default(["publish"]).describe("Limit result set to posts assigned one or more statuses"),
    order: z.enum(["asc", "desc"]).optional().default("desc").describe("Order sort attribute ascending or descending"),
    orderby: z.enum(["author", "date", "id", "modified", "title"]).optional().default("date").describe("Sort collection by post attribute"),
  },
  async ({ siteUrl, username, password, page, perPage, search, status, order, orderby }) => {
    if (!siteUrl || !username || !password) {
      return {
        content: [
          {
            type: "text",
            text: "Error: WordPress credentials not found. Please set WORDPRESS_SITE_URL, WORDPRESS_USERNAME, and WORDPRESS_PASSWORD environment variables or provide them as parameters.",
          },
        ],
      };
    }
    try {
      const params: Record<string, any> = {
        page,
        per_page: perPage,
        order,
        orderby,
        status: status?.join(',')
      };
      
      if (search) params.search = search;

      const posts = await makeWPRequest<WPPost[]>({
        siteUrl,
        endpoint: 'posts',
        auth: { username, password },
        params
      });
      
      const postList = posts.map(post => 
        `ID: ${post.id}\nTitle: ${post.title?.rendered || 'No title'}\nStatus: ${post.status}\nDate: ${post.date}\nExcerpt: ${post.excerpt?.rendered?.substring(0, 200) || 'No excerpt'}...`
      ).join('\n\n');
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${posts.length} posts:\n\n${postList}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving posts: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Get Post
server.tool(
  "get-post",
  "Get a specific WordPress post by ID",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    postId: z.number().describe("ID of the post to retrieve"),
  },
  async ({ siteUrl, username, password, postId }) => {
    try {
      const post = await makeWPRequest<WPPost>({
        siteUrl,
        endpoint: `posts/${postId}`,
        auth: { username, password }
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Post Details:
ID: ${post.id}
Title: ${post.title?.rendered || 'No title'}
Date: ${post.date}
Status: ${post.status}
Author: ${post.author}
Content: 
${post.content?.rendered || 'No content'}
Excerpt: ${post.excerpt?.rendered?.replace(/<[^>]*>/g, '')}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving post: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Create Post
server.tool(
  "create-post",
  "Create a new WordPress post",
  {
    siteUrl: z.string().url().default(DEFAULT_SITE_URL).describe("WordPress site URL (defaults to env WORDPRESS_SITE_URL)"),
    username: z.string().default(DEFAULT_USERNAME).describe("WordPress username (defaults to env WORDPRESS_USERNAME)"),
    password: z.string().default(DEFAULT_PASSWORD).describe("WordPress application password (defaults to env WORDPRESS_PASSWORD)"),
    title: z.string().describe("The title for the post"),
    content: z.string().describe("The content for the post"),
    status: z.enum(["publish", "future", "draft", "pending", "private"]).optional().default("draft").describe("A named status for the post"),
    excerpt: z.string().optional().describe("The excerpt for the post"),
    categories: z.array(z.number()).optional().describe("The terms assigned to the post in the category taxonomy"),
    tags: z.array(z.number()).optional().describe("The terms assigned to the post in the post_tag taxonomy"),
    featuredMedia: z.number().optional().describe("The ID of the featured media for the post"),
    images: z.array(z.object({
      filePath: z.string().describe("Absolute file path to the image"),
      filename: z.string().optional().describe("Optional custom filename (defaults to original filename)"),
      placeholder: z.string().describe("Placeholder in content to replace (e.g., {IMAGE1})")
    })).optional().describe("Array of images to upload and insert into content"),
  },
  async ({ siteUrl, username, password, title, content, status, excerpt, categories, tags, featuredMedia, images }) => {
    if (!siteUrl || !username || !password) {
      return {
        content: [
          {
            type: "text",
            text: "Error: WordPress credentials not found. Please set WORDPRESS_SITE_URL, WORDPRESS_USERNAME, and WORDPRESS_PASSWORD environment variables or provide them as parameters.",
          },
        ],
      };
    }
    try {
      // 複数画像のアップロードと置換処理
      let processedContent = content;
      let uploadedMediaId = featuredMedia;
      
      console.error('=== IMAGE PROCESSING START ===');
      console.error('Original content:', content);
      console.error('Images provided:', images);
      
      if (images && images.length > 0) {
        console.error(`Processing ${images.length} images...`);
        
        for (const image of images) {
          const filename = image.filename || basename(image.filePath);
          console.error(`Processing image: ${filename} from path: ${image.filePath} with placeholder: ${image.placeholder}`);
          
          try {
            // ファイル存在チェック
            if (!existsSync(image.filePath)) {
              throw new Error(`File not found: ${image.filePath}`);
            }
            
            // 画像をアップロード
            console.error(`Uploading image: ${filename} from ${image.filePath}`);
            const mediaId = await uploadMedia(siteUrl, { username, password }, image.filePath, filename);
            console.error(`Image uploaded with ID: ${mediaId}`);
            
            // 最初の画像をアイキャッチに設定（featuredMediaが未指定の場合）
            if (!uploadedMediaId) {
              uploadedMediaId = mediaId;
              console.error(`Set featured media ID: ${mediaId}`);
            }
            
            // WordPressメディア詳細を取得して正しい画像URLを設定
            console.error(`Getting media details for ID: ${mediaId}`);
            const mediaDetails = await makeWPRequest<any>({
              siteUrl,
              endpoint: `media/${mediaId}`,
              auth: { username, password }
            });
            console.error(`Media details retrieved, URL: ${mediaDetails.source_url}`);
            
            // プレースホルダーを画像HTMLに置換
            const imageTag = `<img src="${mediaDetails.source_url}" alt="${filename}" class="wp-image-${mediaId}" />`;
            console.error(`Generated image tag: ${imageTag}`);
            console.error(`Looking for placeholder: ${image.placeholder}`);
            console.error(`Content before replacement: ${processedContent}`);
            
            // 🔍 DEBUG: ファイルログ出力
            appendFileSync('/tmp/mcp-debug.log', `[${new Date().toISOString()}] REPLACEMENT DEBUG\n`);
            appendFileSync('/tmp/mcp-debug.log', `Placeholder: "${image.placeholder}"\n`);
            appendFileSync('/tmp/mcp-debug.log', `ImageTag: "${imageTag}"\n`);
            appendFileSync('/tmp/mcp-debug.log', `Content before: "${processedContent}"\n`);
            
            processedContent = processedContent.replace(image.placeholder, imageTag);
            
            appendFileSync('/tmp/mcp-debug.log', `Content after: "${processedContent}"\n`);
            appendFileSync('/tmp/mcp-debug.log', `Replacement successful: ${!processedContent.includes(image.placeholder)}\n\n`);
            
            console.error(`Content after replacement: ${processedContent}`);
            
          } catch (error) {
            console.error(`Error processing image ${filename}:`, error);
            // エラー時はプレースホルダーをエラーメッセージに置換
            const errorMessage = error instanceof Error ? error.message : String(error);
            processedContent = processedContent.replace(image.placeholder, `[画像アップロードエラー: ${filename} - ${errorMessage}]`);
          }
        }
      } else {
        console.error('No images provided or images array is empty');
      }
      
      console.error('=== IMAGE PROCESSING END ===');
      console.error('Final processed content:', processedContent);

      const postData: Record<string, any> = {
        title,
        content: processedContent,
        status,
      };

      if (excerpt) postData.excerpt = excerpt;
      if (categories) postData.categories = categories;
      if (tags) postData.tags = tags;
      if (uploadedMediaId) postData.featured_media = uploadedMediaId;
      
      const post = await makeWPRequest<WPPost>({
        siteUrl,
        endpoint: 'posts',
        method: 'POST',
        auth: { username, password },
        data: postData
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully created post:
ID: ${post.id}
Title: ${post.title?.rendered}
Status: ${post.status}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating post: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Update Post
server.tool(
  "update-post",
  "Update an existing WordPress post",
  {
    siteUrl: z.string().url().describe("WordPress site URL"),
    username: z.string().describe("WordPress username"),
    password: z.string().describe("WordPress application password"),
    postId: z.number().describe("ID of the post to update"),
    title: z.string().optional().describe("New title for the post"),
    content: z.string().optional().describe("New content for the post"),
    status: z.enum(["publish", "future", "draft", "pending", "private"]).optional().describe("New status for the post"),
    excerpt: z.string().optional().describe("New excerpt for the post"),
    categories: z.array(z.number()).optional().describe("New categories for the post"),
    tags: z.array(z.number()).optional().describe("New tags for the post"),
    featuredMedia: z.number().optional().describe("New featured media ID for the post"),
  },
  async ({ siteUrl, username, password, postId, title, content, status, excerpt, categories, tags, featuredMedia }) => {
    try {
      const updateData: Record<string, any> = {};

      if (title) updateData.title = title;
      if (content) updateData.content = content;
      if (status) updateData.status = status;
      if (excerpt) updateData.excerpt = excerpt;
      if (categories) updateData.categories = categories;
      if (tags) updateData.tags = tags;
      if (featuredMedia) updateData.featured_media = featuredMedia;

      if (Object.keys(updateData).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No update data provided. Please specify at least one field to update.",
            },
          ],
        };
      }

      const post = await makeWPRequest<WPPost>({
        siteUrl,
        endpoint: `posts/${postId}`,
        method: 'POST',
        auth: { username, password },
        data: updateData
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully updated post:
ID: ${post.id}
Title: ${post.title?.rendered}
Status: ${post.status}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating post: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// 画像アップロード用のヘルパー関数（ファイルパス方式）
async function uploadMedia(siteUrl: string, auth: { username: string; password: string }, filePath: string, filename?: string): Promise<number> {
  // 🔍 DEBUG: ファイルパス方式でのアップロード開始
  console.error(`[DEBUG] uploadMedia called with filePath: ${filePath}`);
  console.error(`[DEBUG] Custom filename: ${filename || 'auto-detect'}`);
  
  // ファイル存在チェック
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // ファイル読み取り
  const buffer = readFileSync(filePath);
  const actualFilename = filename || basename(filePath);
  
  // 🔍 DEBUG: ファイル情報
  console.error(`[DEBUG] File size: ${buffer.length} bytes`);
  console.error(`[DEBUG] Filename: ${actualFilename}`);
  console.error(`[DEBUG] File type detected from extension: ${extname(actualFilename)}`);
  
  // ファイル拡張子からContent-Typeを決定
  const ext = extname(actualFilename).toLowerCase();
  let contentType = 'image/jpeg'; // デフォルト
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  
  console.error(`[DEBUG] Determined content type: ${contentType}`);
  
  // FormDataを作成（multipart/form-data方式）
  const formData = new FormData();
  formData.append('file', buffer, {
    filename: actualFilename,
    contentType: contentType,
  });
  
  const authString = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  
  try {
    console.error(`[DEBUG] Sending multipart POST request to: ${siteUrl}/wp-json/wp/v2/media`);
    
    const response = await axios.post(`${siteUrl}/wp-json/wp/v2/media`, formData, {
      headers: {
        'Authorization': `Basic ${authString}`,
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    
    console.error(`[DEBUG] Upload successful! Media ID: ${response.data.id}`);
    console.error(`[DEBUG] Response status: ${response.status}`);
    console.error(`[DEBUG] Media URL: ${response.data.source_url}`);
    console.error(`[DEBUG] File size uploaded: ${response.data.media_details?.filesize || 'unknown'} bytes`);
    
    return response.data.id;
  } catch (error) {
    console.error(`[DEBUG] Upload failed with error:`, error);
    if (axios.isAxiosError(error) && error.response) {
      console.error(`[DEBUG] Error response status: ${error.response.status}`);
      console.error(`[DEBUG] Error response data:`, error.response.data);
      throw new Error(`Media upload error: ${error.response.data?.message || error.message}`);
    }
    throw error;
  }
}

// ================ MAIN ================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WordPress Posts MCP Server running on stdio");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Error running server:", error);
    process.exit(1);
  });
} 