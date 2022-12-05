## andy-blog-koa

- 权限控制
- 无感知Token刷新
- 支持七牛云文件上传
- HTTPS反向代理
- Koa2 + Sequelize
- MySQL

该项目为服务端部分，其它部分可点击下面的链接

- 展示前端 [andy-blog-nuxt](https://github.com/zzlw/andy-blog-nuxt)
- 管理后台 [andy-blog-admin](https://github.com/zzlw/andy-blog-admin)
- 服务端 [andy-blog-koa](https://github.com/zzlw/andy-blog-koa)


## Setup

- 需要把`config`目录下的`config.js.sample`重命名为`config.js`，然后进行相关参数的配置
- 开始需要关闭权限校验中间件，通过`Postman`创建一个超级管理员（看最下面）
- 启动该项目前需要全局安装`nodemon`和`pm2`

```bash
npm install -g nodemon
npm install -g pm2
```

```bash
# install
npm install

# development
npm run start:dev

# production 
npm run start:prod

# docker
docker container run -d --name andy-blog-koa -p 80:3000 zzlwte/andy-blog-koa
```

### 创建超级管理员

1. 打开`app/api/v1/article.js`，找到`authorApi.post('/')`接口，去掉`new Auth().m`中间件
2. 打开`Postman`发送`POST`请求，`Content-Type`设置为`application/json`，`body`输入以下内容：

```javascript
{
  name: '用户名',
  avatar: '填图片地址',
  email: '填email',
  description: '用户描述信息',
  auth: '32', // 32代表超级管理员权限
  password: '', // 密码 英文+数字组合，至少六位
}
```

3. 再把刚刚去掉的中间加回去
