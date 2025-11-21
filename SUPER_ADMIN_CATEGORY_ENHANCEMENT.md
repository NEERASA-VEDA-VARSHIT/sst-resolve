# Enhanced Super-Admin Category Analysis
# Replace lines 620-689 in /superadmin/analytics/page.tsx with this content

```tsx
{/* Categories Tab - ENHANCED FOR SUPER-ADMIN */}
<TabsContent value="categories" className="space-y-4">
  {/* Category Overview Cards */}
  <div className="grid gap-4 md:grid-cols-4">
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Total Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{categoryStats.length}</div>
        <p className="text-xs text-muted-foreground mt-1">
          Tracked across system
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Top Category</CardTitle>
      </CardHeader>
      <CardContent>
        {categoryStats.length > 0 && (
          <div>
            <p className="text-2xl font-bold">{categoryStats[0].name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {categoryStats[0].total} tickets ({((categoryStats[0].total / totalTickets) * 100).toFixed(1)}%)
            </p>
          </div>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Best Performing</CardTitle>
      </CardHeader>
      <CardContent>
        {categoryStats.length > 0 && (() => {
          const bestCategory = categoryStats.reduce((best, cat) => {
            const bestRate = best.total > 0 ? (best.resolved / best.total) : 0;
            const catRate = cat.total > 0 ? (cat.resolved / cat.total) : 0;
            return catRate > bestRate && cat.total >= 5 ? cat : best;
          }, categoryStats[0]);
          const rate = bestCategory.total > 0 ? Math.round((bestCategory.resolved / bestCategory.total) * 100) : 0;
          return (
            <div>
              <p className="text-xl font-bold">{bestCategory.name}</p>
              <p className="text-sm text-green-600 mt-1">
                {rate}% resolution
              </p>
            </div>
          );
        })()}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Needs Attention</CardTitle>
      </CardHeader>
      <CardContent>
        {categoryStats.length > 0 && (() => {
          const worstCategory = categoryStats.reduce((worst, cat) => {
            const worstRate = worst.total > 0 ? (worst.resolved / worst.total) : 100;
            const catRate = cat.total > 0 ? (cat.resolved / cat.total) : 100;
            return catRate < worstRate && cat.total >= 5 ? cat : worst;
          }, categoryStats[0]);
          const rate = worstCategory.total > 0 ? Math.round((worstCategory.resolved / worstCategory.total) * 100) : 0;
          return (
            <div>
              <p className="text-xl font-bold">{worstCategory.name}</p>
              <p className="text-sm text-amber-600 mt-1">
                {rate}% resolution
              </p>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  </div>

  {/* Comprehensive Category Breakdown */}
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        System-Wide Category Analysis
      </CardTitle>
      <CardDescription>
        Deep-dive performance metrics for all categories across the entire system
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-6">
        {categoryStats.map((cat) => {
          const resolutionRate = cat.total > 0 ? Math.round((cat.resolved / cat.total) * 100) : 0;
          const escalationRate = cat.total > 0 ? Math.round((cat.escalated / cat.total) * 100) : 0;
          
          // Time-based breakdown
          const catTicketsToday = allTickets.filter(t => 
            t.category_name === cat.name && t.created_at && t.created_at >= startOfToday
          ).length;
          const catTicketsThisWeek = allTickets.filter(t => 
            t.category_name === cat.name && t.created_at && t.created_at >= startOfWeek
          ).length;
          const catResolvedThisWeek = allTickets.filter(t => 
            t.category_name === cat.name && 
            t.resolved_at && t.resolved_at >= startOfWeek &&
            finalStatuses.has(t.status || "")
          ).length;
          
          // Average resolution time
          const catResolvedWithTime = allTickets.filter(t => 
            t.category_name === cat.name &&
            t.created_at && t.resolved_at &&
            finalStatuses.has(t.status || "")
          );
          const catAvgResolutionHours = catResolvedWithTime.length > 0
            ? catResolvedWithTime.reduce((sum, t) => {
                const hours = (t.resolved_at!.getTime() - t.created_at!.getTime()) / (1000 * 60 * 60);
                return sum + hours;
              }, 0) / catResolvedWithTime.length
            : 0;
          
          // TAT performance
          const catOverdue = allTickets.filter(t => 
            t.category_name === cat.name &&
            t.due_at && !finalStatuses.has(t.status || "") &&
            t.due_at < now
          ).length;
          
          // Staff handling this category
          const catStaff = new Set(allTickets.filter(t => t.category_name === cat.name && t.assigned_to).map(t => t.assigned_to));
          
          // Rating details
          const catRatedTickets = allTickets.filter(t => 
            t.category_name === cat.name && t.rating_submitted && t.rating !== null
          );
          const catAvgRating = catRatedTickets.length > 0
            ? catRatedTickets.reduce((sum, t) => sum + (t.rating || 0), 0) / catRatedTickets.length
            : 0;
          const catHighRatings = catRatedTickets.filter(t => (t.rating || 0) >= 4).length;
          const catSatisfaction = catRatedTickets.length > 0
            ? Math.round((catHighRatings / catRatedTickets.length) * 100)
            : 0;

          return (
            <div key={cat.name} className="border-2 rounded-lg p-6 bg-card hover:shadow-lg transition-all">
              {/* Category Header */}
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h4 className="text-xl font-bold flex items-center gap-2">
                    <Layers className="h-6 w-6 text-primary" />
                    {cat.name}
                  </h4>
                  <div className="flex gap-3 mt-2 text-sm text-muted-foreground">
                    <span>{((cat.total / totalTickets) * 100).toFixed(1)}% of all tickets</span>
                    <span>•</span>
                    <span>{catStaff.size} staff assigned</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-sm">{cat.total} total</Badge>
                  {catOverdue > 0 && (
                    <Badge variant="destructive" className="text-sm">{catOverdue} overdue</Badge>
                  )}
                  {escalationRate > 20 && (
                    <Badge variant="destructive" className="text-sm">High Escalation</Badge>
                  )}
                </div>
              </div>

              {/* Main Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
                <div className="text-center p-4 bg-muted/50 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">Total</p>
                  <p className="text-3xl font-bold">{cat.total}</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200">
                  <p className="text-xs text-muted-foreground mb-1">Resolved</p>
                  <p className="text-3xl font-bold text-green-600">{cat.resolved}</p>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200">
                  <p className="text-xs text-muted-foreground mb-1">Pending</p>
                  <p className="text-3xl font-bold text-amber-600">{cat.pending}</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200">
                  <p className="text-xs text-muted-foreground mb-1">Escalated</p>
                  <p className="text-3xl font-bold text-red-600">{cat.escalated}</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200">
                  <p className="text-xs text-muted-foreground mb-1">Avg Rating</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {catAvgRating > 0 ? catAvgRating.toFixed(1) : '-'}
                  </p>
                </div>
              </div>

              {/* Performance Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                {/* Resolution Performance */}
                <div className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Resolution Metrics
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Resolution Rate</span>
                        <span className="font-bold">{resolutionRate}%</span>
                      </div>
                      <Progress value={resolutionRate} className="h-2" />
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t">
                      <span>Avg Time:</span>
                      <span className="font-medium">
                        {catAvgResolutionHours > 24 
                          ? `${(catAvgResolutionHours / 24).toFixed(1)}d`
                          : `${catAvgResolutionHours.toFixed(1)}h`
                        }
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {resolutionRate >= 80 ? '✅ Excellent performance' : 
                       resolutionRate >= 60 ? '⚠️ Good, room for improvement' : 
                       '❌ Needs immediate attention'}
                    </p>
                  </div>
                </div>

                {/* Quality Metrics */}
                <div className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold flex items-center gap-1">
                      <Award className="h-4 w-4 text-purple-600" />
                      Quality Metrics
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Satisfaction</span>
                        <span className="font-bold">{catSatisfaction}%</span>
                      </div>
                      <Progress value={catSatisfaction} className="h-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                      <div>
                        <span className="text-muted-foreground">Rated:</span>
                        <p className="font-medium">{catRatedTickets.length}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">High (4-5★):</span>
                        <p className="font-medium text-green-600">{catHighRatings}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Escalation & Issues */}
                <div className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      Issues & Alerts
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Escalation Rate</span>
                        <span className="font-bold text-red-600">{escalationRate}%</span>
                      </div>
                      <Progress value={escalationRate} className="h-2 bg-red-100" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                      <div>
                        <span className="text-muted-foreground">Overdue:</span>
                        <p className="font-medium text-red-600">{catOverdue}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Esc:</span>
                        <p className="font-medium">{cat.escalated}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Time-based Trends */}
              <div className="border-t pt-5">
                <h5 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Weekly Activity Trends
                </h5>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Created This Week</p>
                    <p className="text-2xl font-bold">{catTicketsThisWeek}</p>
                    <p className="text-xs text-muted-foreground mt-1">{catTicketsToday} today</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Resolved This Week</p>
                    <p className="text-2xl font-bold text-green-600">{catResolvedThisWeek}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {catTicketsThisWeek > 0 ? Math.round((catResolvedThisWeek / catTicketsThisWeek) * 100) : 0}% rate
                    </p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Backlog</p>
                    <p className="text-2xl font-bold text-amber-600">{cat.pending}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cat.total > 0 ? Math.round((cat.pending / cat.total) * 100) : 0}% of total
                    </p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Staff Assigned</p>
                    <p className="text-2xl font-bold text-purple-600">{catStaff.size}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {catStaff.size > 0 ? (cat.total / catStaff.size).toFixed(1) : 0} avg/staff
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="border-t pt-5 mt-5">
                <h5 className="text-sm font-semibold mb-3">Status Distribution</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {ticketStatuses
                    .filter(status => {
                      return allTickets.filter(t => t.category_name === cat.name && t.status === status.value).length > 0;
                    })
                    .map(status => {
                      const count = allTickets.filter(t => 
                        t.category_name === cat.name && t.status === status.value
                      ).length;
                      const percentage = cat.total > 0 ? ((count / cat.total) * 100).toFixed(0) : 0;
                      return (
                        <div key={status.id} className="flex items-center justify-between p-3 bg-muted/30 rounded border">
                          <div className="flex-1">
                            <Badge variant={status.badge_color as any || "default"} className="text-xs mb-1">
                              {status.label}
                            </Badge>
                            <p className="text-xs text-muted-foreground">{percentage}%</p>
                          </div>
                          <span className="text-lg font-bold">{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* AI-Driven Insights */}
              {(escalationRate > 15 || resolutionRate < 60 || catOverdue > 2 || catAvgResolutionHours > 72) && (
                <div className="mt-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg border-2 border-amber-200 dark:border-amber-800">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-2">
                        📊 System-Generated Insights & Recommendations:
                      </p>
                      <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
                        {escalationRate > 15 && (
                          <li className="flex items-start gap-2">
                            <span className="font-bold">•</span>
                            <span><strong>High Escalation ({escalationRate}%):</strong> Review POC assignments or provide targeted training for this category. Consider creating a knowledge base.</span>
                          </li>
                        )}
                        {resolutionRate < 60 && (
                          <li className="flex items-start gap-2">
                            <span className="font-bold">•</span>
                            <span><strong>Low Resolution Rate ({resolutionRate}%):</strong> {cat.pending} pending tickets need attention. Consider increasing staff allocation or reviewing workflow efficiency.</span>
                          </li>
                        )}
                        {catOverdue > 2 && (
                          <li className="flex items-start gap-2">
                            <span className="font-bold">•</span>
                            <span><strong>Critical: {catOverdue} Overdue Tickets:</strong> Immediate action required. Reassign or escalate to prevent SLA breaches.</span>
                          </li>
                        )}
                        {catAvgResolutionHours > 72 && (
                          <li className="flex items-start gap-2">
                            <span className="font-bold">•</span>
                            <span><strong>Slow Resolution Time ({(catAvgResolutionHours / 24).toFixed(1)} days):</strong> Optimize workflow, add automation, or review category complexity.</span>
                          </li>
                        )}
                        {catSatisfaction < 70 && catRatedTickets.length > 5 && (
                          <li className="flex items-start gap-2">
                            <span className="font-bold">•</span>
                            <span><strong>Low Satisfaction ({catSatisfaction}%):</strong> Review student feedback, improve communication, or enhance resolution quality.</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

## Implementation Notes:
1. This enhanced version includes all the features from the admin analytics plus system-wide perspectives
2. Added staff assignment tracking per category
3. More detailed insights with AI-driven recommendations
4. Visual hierarchy with color-coded metric cards
5. Weekly trends and comparative analysis
6. Status distribution per category

Replace lines 620-689 in your super-admin analytics page with this code.
