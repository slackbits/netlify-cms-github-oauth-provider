require('dotenv').config({silent: true})
const express = require('express')
const simpleOauthModule = require('simple-oauth2')
const randomstring = require('randomstring')
const port = process.env.PORT || 3000
const isDebug = process.env.OAUTH_DEBUG === "true" || false

console.log(`DEBUG: ${process.env.OAUTH_DEBUG}`);
if (isDebug) {
  console.log(`Client ID: ${process.env.OAUTH_CLIENT_ID}`);
  console.log(`Client SECRET: ${process.env.OAUTH_CLIENT_SECRET}`)
}

const app = express()
const oauth2 = simpleOauthModule.create({
  client: {
    id: process.env.OAUTH_CLIENT_ID,
    secret: process.env.OAUTH_CLIENT_SECRET
  },
  auth: {
    // Supply GIT_HOSTNAME for enterprise github installs.
    tokenHost: process.env.GIT_HOSTNAME || 'https://github.com',
    tokenPath: process.env.OAUTH_TOKEN_PATH || '/login/oauth/access_token',
    authorizePath: process.env.OAUTH_AUTHORIZE_PATH || '/login/oauth/authorize'
  }
})

// Authorization uri definition
const authorizationUri = oauth2.authorizationCode.authorizeURL({
  redirect_uri: process.env.REDIRECT_URL,
  scope: process.env.SCOPES || 'repo,user',
  state: randomstring.generate(32)
})

// Initial page redirecting to Github
app.get('/auth', (req, res) => {
  res.redirect(authorizationUri)
})

// Callback service parsing the authorization token and asking for the access token
app.get('/callback', (req, res) => {
  const code = req.query.code
  const options = {
    code: code
  }

  oauth2.authorizationCode.getToken(options, (error, result) => {
    let mess, content

    if (error) {
      console.error('Access Token Error', error.message)
      mess = 'error'
      content = JSON.stringify(error)
    } else {
      if (isDebug) {
        console.log("================");
        console.log("  RAW RESULTS");
        console.log("================");
        console.log(result); 
      }
      const token = oauth2.accessToken.create(result)
      if (isDebug) {
        console.log("================");
        console.log("  Paresed Token");
        console.log("================");
        console.log(token.token.access_token); 
      }
      mess = 'success'
      content = {
        token: token.token.access_token,
        provider: 'github'
      }
    }

    const script = `
    <script>
    (function() {
      function recieveMessage(e) {
        console.log("recieveMessage %o", e)
        // send message to main window with da app
        window.opener.postMessage(
          'authorization:github:${mess}:${JSON.stringify(content)}',
          e.origin
        )
      }
      window.addEventListener("message", recieveMessage, false)
      // Start handshare with parent
      console.log("Sending message: %o", "github")
      window.opener.postMessage("authorizing:github", "*")
      })()
    </script>`
    return res.send(script)
  })
})

app.get('/success', (req, res) => {
  res.send('')
})

app.get('/', (req, res) => {
  res.send('Hello<br><a href="/auth">Log in with Github</a>')
})

app.listen(port, () => {
  console.log("gandalf is walkin' on port " + port)
})