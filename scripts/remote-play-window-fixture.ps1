param(
  [string]$Title = "PS Remote Play",
  [string]$HandlePath = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = $Title
$form.ClientSize = New-Object System.Drawing.Size(960, 540)
$form.StartPosition = "CenterScreen"
$form.BackColor = [System.Drawing.Color]::FromArgb(18, 24, 38)

$title = New-Object System.Windows.Forms.Label
$title.AutoSize = $true
$title.Font = New-Object System.Drawing.Font("Segoe UI", 28, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::White
$title.Location = New-Object System.Drawing.Point(54, 62)
$title.Text = if ($Title -eq "PS Remote Play") { "PulseCast WGC fixture" } else { "PulseCast preview host" }
$form.Controls.Add($title)

$truth = New-Object System.Windows.Forms.Label
$truth.AutoSize = $true
$truth.Font = New-Object System.Drawing.Font("Segoe UI", 15)
$truth.ForeColor = [System.Drawing.Color]::FromArgb(194, 255, 40)
$truth.Location = New-Object System.Drawing.Point(58, 132)
$truth.Text = "MOCK REMOTE PLAY WINDOW - REAL WINDOWS CAPTURE"
$form.Controls.Add($truth)

$clock = New-Object System.Windows.Forms.Label
$clock.AutoSize = $true
$clock.Font = New-Object System.Drawing.Font("Consolas", 42, [System.Drawing.FontStyle]::Bold)
$clock.ForeColor = [System.Drawing.Color]::FromArgb(91, 205, 255)
$clock.Location = New-Object System.Drawing.Point(54, 230)
$form.Controls.Add($clock)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 100
$timer.Add_Tick({
  $clock.Text = [DateTime]::UtcNow.ToString("HH:mm:ss.fff")
})
$timer.Start()

$form.Add_Shown({
  if ($HandlePath) {
    $handleValue = "0x{0:x}" -f $form.Handle.ToInt64()
    Set-Content -LiteralPath $HandlePath -Value $handleValue -Encoding ASCII
  }
})

[void]$form.ShowDialog()
