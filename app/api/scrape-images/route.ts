import { NextRequest, NextResponse } from 'next/server';



export async function POST(request: NextRequest) {

  try {

    const { url } = await request.json();



    if (!url) {

      return NextResponse.json(

        { error: '请提供网址' },

        { status: 400 }

      );

    }



    // 验证URL格式

    try {

      new URL(url);

    } catch {

      return NextResponse.json(

        { error: '无效的网址格式' },

        { status: 400 }

      );

    }



    // 获取网页内容

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {

      headers: {

        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',

      },

      signal: controller.signal,

    });

    clearTimeout(timeoutId);


    if (!response.ok) {

      return NextResponse.json(

        { error: `无法访问网址: ${response.status}` },

        { status: 400 }

      );

    }



    const html = await response.text();



    // 使用正则表达式提取图片URL

    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

    

    const images = new Set<string>();

    let match;



    // 从 src 属性提取

    while ((match = imgRegex.exec(html)) !== null) {

      let imgUrl = match[1];

      

      // 转换相对URL为绝对URL

      if (imgUrl.startsWith('/')) {

        const baseUrl = new URL(url);

        imgUrl = `${baseUrl.protocol}//${baseUrl.host}${imgUrl}`;

      } else if (imgUrl.startsWith('../') || imgUrl.startsWith('./')) {

        const baseUrl = new URL(url);

        const path = new URL(imgUrl, baseUrl).href;

        imgUrl = path;

      } else if (!imgUrl.startsWith('http')) {

        const baseUrl = new URL(url);

        imgUrl = new URL(imgUrl, baseUrl).href;

      }



      // 过滤掉极小的图片（可能是 logo 或 icon）、数据URL、以及常见的追踪像素

      if (imgUrl.length > 50 && 

          !imgUrl.startsWith('data:') &&

          !imgUrl.includes('1x1') &&

          !imgUrl.includes('pixel') &&

          !imgUrl.includes('tracker') &&

          !imgUrl.includes('analytics')) {

        images.add(imgUrl);

      }

    }



    return NextResponse.json({

      images: Array.from(images).slice(0, 20), // 限制返回20张

      count: images.size,

    });

  } catch (error) {

    console.error('爬取图片错误:', error);

    return NextResponse.json(

      { error: '爬取图片失败，请检查网址是否正确' },

      { status: 500 }

    );

  }

}

