# Cloudflare R2 配置指南

本指南将手把手教你如何从零开始配置 Cloudflare R2 并将其集成到 EzImage 插件中。

## 1. 什么是 Cloudflare R2？
Cloudflare R2 是一种对象存储服务，它最迷人的地方在于 **0 流量分发费 (Zero Egress Fees)**。对于图床场景，这意味着无论你的图片被访问多少次，你都不需要支付流量费。

### 费用说明
- **存储**: 前 10GB 免费。
- **操作**: 每月前 100 万次 A 类操作（写）和 1000 万次 B 类操作（读）免费。
- **流量**: **完全免费**。

---

## 2. 注册登录Cloudflare账号


1. 注册登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。推荐直接使用谷歌账号快速登录！

![ezimage-1772347695585.png](https://images.flashnote.top/2026/03/1772347697157-rfql43q0.png)

2. 登录成功之后，，可以把语言切成中文，方便阅读

![ezimage-1772347899111.png](https://images.flashnote.top/2026/03/1772347902211-krwcryfp.png)

3. 在左侧菜单选择找到 **存储和数据库->R2对象存储->概述**

![ezimage-1772348023788.png](https://images.flashnote.top/2026/03/1772348026266-4gzfwngx.png)

4. 第一次使用这个需要订阅绑定一下支付卡，国内 Visa、MasteCard 都行，也可以使用 Paypal。如果你的浏览器之前绑定过类似的卡，会带出底下的信息，就不用手动填了，没有的话，那就自己手动填一下。

![ezimage-1772348429412.png](https://images.flashnote.top/2026/03/1772348433779-z4gwjqve.png)


---

## 3. 创建与配置存储桶 (Bucket)

1.  回到 R2 概览页面，点击 **创建存储桶**。

![ezimage-1772348595524.png](https://images.flashnote.top/2026/03/1772348596875-czc61kx4.png)

2.  输入名称（例如 `my-images`），位置可以选择**亚太地区**，然后点击 **创建存储桶**。

![ezimage-1772348778570.png](https://images.flashnote.top/2026/03/1772348782094-5uhpn8co.png)

3. 会自动跳转到刚刚创建的桶界面

![ezimage-1772348899377.png](https://images.flashnote.top/2026/03/1772348901208-da8b45uh.png)

4.  **开启公开访问 (Public Access)**：
    *   进到刚才创建的桶，点击 **设置** 选项卡。
    *   找到 **Public Access** 区域。
    *   **方式 A (推荐)**: 绑定你的自定义域名，例如 `img.yourdomain.com`。
    *   **方式 B**: 开启允许通过 R2.dev 访问（适合测试，但有速度限制且不稳定）。

    如果你有在 Cloudflare 绑定过自己的域名，那么推荐你直接用自定义域名。如果没有可以直接按方式 B,启动公共开发 URL。

![ezimage-1772349248132.png](https://images.flashnote.top/2026/03/1772349251108-qkgve68a.png)

5. 配置CORS 策略
这一步很关键，如果不配置的话，很多平台可能图片无法正常显示

![ezimage-1772349692679.png](https://images.flashnote.top/2026/03/1772349695839-0kx9wyx8.png)

```
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "MaxAgeSeconds": 86400
  }
]
```
## 4. 创建User API 令牌
回到首页，找到之前的 **概述**，点击*Manage*

![ezimage-1772349998578.png](https://images.flashnote.top/2026/03/1772350001543-fyowx6rn.png)

然后点击**创建User API 令牌**
![ezimage-1772350077245.png](https://images.flashnote.top/2026/03/1772350078818-ak5yvqrp.png)

填入对应的信息

![ezimage-1772350193965.png](https://images.flashnote.top/2026/03/1772350196880-wssattu6.png)

- 令牌名称：可以随便起
- 权限：选择**对象读和写**
- 指定存储桶：选择刚才创建的存储桶
- TTL: 默认**永久**

点击**创建 User API 令牌**

![ezimage-1772350429343.png](https://images.flashnote.top/2026/03/1772350431974-7brb3x0n.png)

保存底下的三个关建值，后续看不到
 - 访问密钥 ID (Access Key ID)
 - 机密访问密钥 (Secret Access Key)
 - S3 终结点 URL

---

## 5.配置插件
1.  在 VS Code 中按下 `Cmd+Shift+P`。
2.  输入并选择 `EzImage: Configure Settings`。
3.  填入对应的参数：
    - **Provider**: `r2`
    - **Access Key ID**: 填入上一步获取的访问密钥。
    - **Account ID**: 填入Account ID （存储和数据库->R2对象存储->概述->Account Details->Account ID）。
    - **Secret Access Key**: 填入上一步获取的机密访问密钥。
    - **Bucket Name**: 填入上一步创建的名称。
    - **Public URL**: 填入绑定的自定义域名（例如 `https://img.yourdomain.com`）或者公共 URL，注意末尾不要带斜杠。

![ezimage-1772350721364.png](https://images.flashnote.top/2026/03/1772350723772-5woccmmt.png)

---

## 6. 验证
打开一个 md 文件，截图一张图片，然后按下快捷键 `Cmd+Alt+V` (Mac) 或 `Ctrl+Alt+V` (Win/Linux)，如果图片上传成功，并且在 md 文件中插入了图片链接，那么恭喜你，配置成功！


IED 左下角显示进度

![ezimage-1772350993054.png](https://images.flashnote.top/2026/03/1772350993434-z439wp2d.png)

结束后成功插入图片

![ezimage-1772350973823.png](https://images.flashnote.top/2026/03/1772350974539-y79ld579.png)

---

## 第三方平台验证

![ezimage-1772351204437.png](https://images.flashnote.top/2026/03/1772351216030-ypvkiwgi.png)

![ezimage-1772351350664.png](https://images.flashnote.top/2026/03/1772351362779-lxmn3dx5.png)

## 7. 常见问题排查

-   **上传 403 错误**: 请检查 API Token 的权限是否授予了读写权限，以及 `Account ID` 是否填写正确。
-   **图片无法显示**: 请确保在 Bucket 的 Settings 中已经开启了 **Public Access** 并正确绑定了域名。
-   **域名未生效**: 如果是新绑定的域名，可能需要几分钟的时间进行 DNS 同步。

---

