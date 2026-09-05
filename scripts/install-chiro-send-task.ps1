# Registers the one-off Windows task that sends the chiropractor batch.
#
#   powershell -ExecutionPolicy Bypass -File scripts\install-chiro-send-task.ps1
#
# Fires ONCE, Tuesday 8 September 2026 at 9:30am local, then the task stays
# registered but does not repeat. Re-run this script to schedule another date.
#
# StartWhenAvailable is deliberately FALSE. If the machine is asleep at 9:30 the
# batch simply does not go, and that is the safer failure: a task that catches up
# later would mail thirty chiropractors at two in the morning, which is worse
# than not mailing them at all. Same reasoning as the camp walk-in report.

$ErrorActionPreference = 'Stop'

$TaskName = 'Active10 Chiro Batch Send'
$Repo     = 'C:\Users\darri\active10-wholesale'
$Script   = "$Repo\scripts\send-chiro-batch.mjs"
$When     = Get-Date '2026-09-08 09:30:00'

if (-not (Test-Path $Script)) { throw "Cannot find $Script" }

$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node `
    -Argument "`"$Script`" --live" -WorkingDirectory $Repo

$trigger = New-ScheduledTaskTrigger -Once -At $When

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable:$false `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3)

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false } catch {}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Description 'Sends the Active 10 chiropractor first-touch batch, one every 150s.' | Out-Null

$t = Get-ScheduledTask -TaskName $TaskName
$i = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Output "Registered: $($t.TaskName)"
Write-Output "State     : $($t.State)"
Write-Output "Next run  : $($i.NextRunTime)"
Write-Output ""
Write-Output "The machine must be awake at that time - StartWhenAvailable is off on purpose."
Write-Output 'To cancel:  Unregister-ScheduledTask -TaskName ''Active10 Chiro Batch Send'' -Confirm:$false'
