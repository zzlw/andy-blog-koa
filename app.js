require('module-alias/register')

const Koa = require('koa')
const parser = require('koa-bodyparser')
const InitManager = require('./core/init')
const catchError = require('./middleware/exception')
const cors = require('koa2-cors');
const multipart = require('./core/multipart')

const app = new Koa()

app.use(cors({
    origin: function (ctx) {
        return ctx.header.origin
      }
  }))
app.use(catchError)
app.use(parser())
multipart(app)

InitManager.initCore(app)

app.listen(3000, () => {
  console.log(`当前 NODE_ENV ${process.env.NODE_ENV}. listening port 3000`)
})