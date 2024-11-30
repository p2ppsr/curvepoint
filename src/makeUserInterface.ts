export default () => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
  <title>Overlay Services</title>
  <style>
    body {
      font-family: Arial;
      background-color: #282E33;
      overflow: hidden;
    }

    * {
      color: #B6C2CF;
    }

    .main {
      height: 100vh;
      word-wrap: break-word;
      display: flex;
      flex-direction: row;
    }

    a {
      color: #579DFF;
    }

    .docs_heading {
      text-align: center;
      padding-bottom: 0.5em;
      border-bottom: thin solid #B6C2CF;
    }

    .topic_container {
      padding-top: 1.5em;
    }

    .provider_container {
      padding-top: 1.5em;
    }

    li {
      display: block;
      padding: 0.2em;
      margin-top: 0.5em;
      width: 10em;
      border-radius: 5%;
    }

    .list_a {
      display: block;
      width: 10em;
      color: #B6C2CF;
      text-decoration: none;
    }

    li:hover,
    li:active {
      cursor: pointer;
      background-color: #323940;
    }

    ul {
      list-style-type: none;
      margin-top: 1em;
    }

    .column_left {
      display: flex;
      flex-direction: column;
      float: left;
      width: 40%;
      height: 100vh;
      overflow-y: scroll;
      padding-top: 1.5em;
    }

    .column_right {
      display: flex;
      flex-direction: column;
      float: right;
      width: 60%;
      height: 100vh;
      overflow-y: scroll;
      border-left: thin solid #B6C2CF;
      padding-top: 1.5em;
    }

    @media screen and (max-width: 850px) {

      .main {
        width: 100vw;
        float: none;
        overflow-y: scroll;
        display: block;
      }

      .column_left {
        width: 100vw;
        height: auto;
        float: none;
        overflow-y: visible;
        display: block;
      }

      .column_right {
        width: 100vw;
        height: auto;
        float: none;
        overflow-y: visible;
        display: block;
        border: none;
      }

    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/showdown@2.0.3/dist/showdown.min.js"></script>
  <script>
        const showdown = window.showdown

        const Convert = (md) => {
          let converter = new showdown.Converter()
          let converted = converter.makeHtml(md)
          return converted
        }

        window.managerDocumentation = async (manager) => {
          let res = await window.fetch(\`/getDocumentationForTopicManager?manager=\${manager}\`)
          let docs = await res.json()
          let managerReadme = Convert(docs)
          document.getElementById('documentation_container').innerHTML = managerReadme
          document.getElementById('documentation_title').innerHTML = \`<h1 class="docs_heading">\${manager + ' Topic Manager'}</h1>\`
        }

        window.topicDocumentation = async (provider) => {
          let res = await window.fetch(\`/getDocumentationForLookupServiceProvider?lookupServices=\${provider}\`)
          let docs = await res.json()
          let providerReadme = Convert(docs)
          document.getElementById('documentation_container').innerHTML = providerReadme
          document.getElementById('documentation_title').innerHTML = \`<h1 class="docs_heading">\${provider + ' Lookup Service'}</h1>\`
        }

        window.fetch('/listTopicManagers')
          .then((res) => {
            return res.json()
          })
          .then((managers) => {
            for (i = 0; i < managers.length; i++) {
              let li = document.createElement('li')
              li.innerHTML = \`<a class="list_a" onclick="window.managerDocumentation('\${managers[i]}')">\${managers[i]}</a>\`
              manager_list.appendChild(li)
            }
          })
          .catch(() => {
            let message = document.createElement('h4')
            message.innerText = 'Something went wrong!'
            manager_list.insertBefore(message, manager_list.children[0])
          })

        window.fetch('/listLookupServiceProviders')
          .then((res) => {
            return res.json()
          })
          .then((providers) => {
            for (i = 0; i < providers.length; i++) {
              let li = document.createElement('li')
              li.innerHTML = \`<a class="list_a" onclick="window.topicDocumentation('\${providers[i]}')">\${providers[i]}</a>\`
              provider_list.appendChild(li)
            }
          })
          .catch(() => {
            let message = document.createElement('h4')
            message.innerText = 'Something went wrong!'
            provider_list.insertBefore(message, provider_list.children[0])
          })
      </script>
</head>

<body>
  <div class='main'>
    <div class="column_left">
      <div class="page_head">
        <h1>Hello Overlay Services</h1>
        <p>Learn more on <a href='https://github.com/bitcoin-sv/overlay-services'>GitHub</a></p>
      </div>
      <div class="topic_container">
        <h2>Endpoint Documentation:</h2>
        <h3>Supported Topic Managers:</h3>
        <ul id="manager_list"></ul>
      </div>
      <div class="provider_container">
        <h3>Supported Lookup Service Providers:</h3>
        <ul id="provider_list"></ul>
      </div>
      <br />
    </div>
    <div class="column_right">
      <div id="documentation_title"></div>
      <div id="documentation_container" style="margin-left: 1.5em">
      </div>
    </div>
  </div>
</body>
</html>`