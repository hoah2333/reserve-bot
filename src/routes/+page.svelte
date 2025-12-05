<script lang="ts">
  export let data;
</script>

<div class="header">
  <h2>翻译预定归档列表</h2>
</div>

<div class="reserve-table">
  <table>
    <thead>
      <tr>
        <th>序号</th>
        <th>预定用户</th>
        <th>预定时间</th>
        <th>原文链接</th>
        <th>预定标题</th>
      </tr>
    </thead>
    <tbody>
      {#each data.dbContent as dbData, index}
        <tr>
          <td data-id={dbData._id}>{index + 1}</td>
          <td data-id={dbData._id}>
            <a
              href="https://www.wikidot.com/user:info/{dbData.username
                .replace(/[.'!&\-\\/\(\)\+ ]+/g, '-')
                .toLowerCase()}"
              target="_blank"
              rel="noopener noreferrer"
            >
              {dbData.username}
            </a>
          </td>
          <td data-id={dbData._id}>{new Date(dbData.date).toLocaleString()}</td>
          <td data-id={dbData._id}>
            <a href={dbData.originalLink} target="_blank" rel="noopener noreferrer">
              {dbData.originalLink}
            </a>
          </td>
          <td data-id={dbData._id}>
            <a
              href="https://backrooms-tech-cn.wikidot.com/{dbData.reservePage}"
              target="_blank"
              rel="noopener noreferrer"
            >
              {dbData.title}
            </a>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style lang="scss" type="text/scss">
  @import "./page";
</style>
