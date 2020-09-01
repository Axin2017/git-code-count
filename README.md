# 简介
这是一款用于统计你在git上提交了多少代码量的统计工具

# 安装
```
npm i git-code-count -g
```

# 使用

## 配置

此工具需要在当前执行目录下面有一个 `.git-code-count-config.js` 配置文件。具体例子请见[配置文件完整示例](#配置文件完整示例)

## 运行

```shell
cd D:\workSpace

git-code-count
```

## 配置文件完整示例
```js
module.exports = {
  availableProject:[
    {
      name: '集客',
      path: './tungee/inbound-frontend/inbound'
    },
    {
      name: '集客客服sdk',
      path: './tungee/inbound-frontend/sdk-smart-cs'
    },
    {
      name: '集客落地页',
      path: './tungee/inbound-frontend/turkey-html'
    }
  ],
  author: 'tanxin'
}
```

## 配置项说明

+ `availableProject`: 必填。值为 `name` 与 `path` 组成的对象的数组。因考虑到项目不太可能经常变动，所以省略了每次选择项目的步骤，改为配置文件。
+ `author`: 选填。git上提交的日志，会有作者来表示是谁提交的。如我提交的代码，author是`tanxin@xxx.com`，那我这个参数输入`tanxin`就可以了，当然也可以输入全部来百分百匹配。如果不配置此选项，每次使用工具的时候会让用户手动输入。


# 注意
`nodejs` 版本请尽量用 `8.x或更高` 版本，因为我使用了 `async` , `await` , `trim` 等新语法，而又懒得转译。。。
