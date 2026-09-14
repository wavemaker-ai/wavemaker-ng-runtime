import fs from 'fs';
import path from 'path';
export function createSyntheticWaveMakerProject(targetDir) {
    const projectRoot = path.resolve(targetDir);
    const pagesDir = path.join(projectRoot, 'src/main/webapp/pages');
    // Create folder structure
    fs.mkdirSync(path.join(pagesDir, 'Main'), { recursive: true });
    fs.mkdirSync(path.join(pagesDir, 'Dashboard'), { recursive: true });
    // 1. Page Main HTML (Unpaginated table, rich text editor, deep DOM)
    const mainHtml = `
<wm-page name="MainPage">
  <wm-content name="content1">
    <wm-layoutgrid name="layoutgrid1">
      <wm-gridrow name="gridrow1">
        <wm-gridcolumn name="gridcolumn1">
          <wm-container name="container1">
            <wm-panel name="panel1">
              <wm-layoutgrid name="layoutgrid2">
                <wm-gridrow name="gridrow2">
                  <wm-gridcolumn name="gridcolumn2">
                    <wm-container name="container2">
                      <wm-panel name="panel2">
                        <wm-layoutgrid name="layoutgrid3">
                          <wm-gridrow name="gridrow3">
                            <wm-gridcolumn name="gridcolumn3">
                              <!-- Deeply nested table without pagination -->
                              <wm-table name="ordersTable" navigation="None" dataset="bind:Variables.ordersData.dataSet">
                              </wm-table>
                              <!-- Heavy widget on landing page -->
                              <wm-richtexteditor name="notesEditor"></wm-richtexteditor>
                            </wm-gridcolumn>
                          </wm-gridrow>
                        </wm-layoutgrid>
                      </wm-panel>
                    </wm-container>
                  </wm-gridcolumn>
                </wm-gridrow>
              </wm-layoutgrid>
            </wm-panel>
          </wm-container>
        </wm-gridcolumn>
      </wm-gridrow>
    </wm-layoutgrid>
  </wm-content>
</wm-page>
`;
    fs.writeFileSync(path.join(pagesDir, 'Main/Main.html'), mainHtml, 'utf8');
    // 2. Page Main Variables (Startup waterfall & unbounded query)
    const mainVariables = {
        ordersData: {
            category: 'wm.LiveVariable',
            startUpdate: true,
            maxResults: '' // Unbounded!
        },
        userProfile: {
            category: 'wm.ServiceVariable',
            startUpdate: true
        },
        notifications: {
            category: 'wm.ServiceVariable',
            startUpdate: true
        },
        recentActivities: {
            category: 'wm.LiveVariable',
            startUpdate: true,
            maxResults: 20
        },
        systemMetrics: {
            category: 'wm.ServiceVariable',
            startUpdate: true
        },
        pendingTasks: {
            category: 'wm.LiveVariable',
            startUpdate: true,
            maxResults: 50
        },
        extraSettings: {
            category: 'wm.ServiceVariable',
            startUpdate: true // 7 startup variables -> waterfall!
        }
    };
    fs.writeFileSync(path.join(pagesDir, 'Main/Main.variables.json'), JSON.stringify(mainVariables, null, 2), 'utf8');
    // 3. Page Main JS (Leaking timer & listener)
    const mainJs = `
Page.onPageReady = function () {
    // Leaking timer without clearInterval in onPageDestroy
    Page.refreshTimer = setInterval(function () {
        console.log("Polling updates...");
    }, 5000);

    // Leaking window event listener
    window.addEventListener("resize", function () {
        console.log("Resized");
    });
};
`;
    fs.writeFileSync(path.join(pagesDir, 'Main/Main.js'), mainJs, 'utf8');
    // 4. Page Dashboard (Clean page with paginated table)
    const dashboardHtml = `
<wm-page name="DashboardPage">
  <wm-content name="content2">
    <wm-table name="salesSummaryTable" navigation="Pager" pagesize="15" dataset="bind:Variables.salesData.dataSet">
    </wm-table>
  </wm-content>
</wm-page>
`;
    fs.writeFileSync(path.join(pagesDir, 'Dashboard/Dashboard.html'), dashboardHtml, 'utf8');
    const dashboardVariables = {
        salesData: {
            category: 'wm.LiveVariable',
            startUpdate: false,
            maxResults: 15
        }
    };
    fs.writeFileSync(path.join(pagesDir, 'Dashboard/Dashboard.variables.json'), JSON.stringify(dashboardVariables, null, 2), 'utf8');
    return projectRoot;
}
