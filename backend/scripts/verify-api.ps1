param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$AdminEmail = "admin@ramstore.com",
    [string]$AdminPassword = "Admin@12345",
    [string]$ClientEmail = "client1@ramstore.com",
    [string]$ClientPassword = "Client@12345"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/8] Health check"
$health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health"
$health | ConvertTo-Json -Depth 5

Write-Host "[2/8] Register client (idempotent)"
try {
    $registerBody = @{
        first_name = "Client"
        last_name = "One"
        email = $ClientEmail
        phone_number = "+12345678911"
        city = "Berlin"
        age = 25
        type = "client"
        password = $ClientPassword
    } | ConvertTo-Json

    Invoke-RestMethod -Method Post -Uri "$BaseUrl/register" -ContentType "application/json" -Body $registerBody | Out-Null
    Write-Host "Client registered"
}
catch {
    Write-Host "Register skipped/failure (possibly duplicate user): $($_.Exception.Message)"
}

Write-Host "[3/8] Login admin"
$adminLoginBody = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json
$adminLogin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/login" -ContentType "application/json" -Body $adminLoginBody
$adminToken = $adminLogin.access_token

Write-Host "[4/8] Login client"
$clientLoginBody = @{ email = $ClientEmail; password = $ClientPassword } | ConvertTo-Json
$clientLogin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/login" -ContentType "application/json" -Body $clientLoginBody
$clientToken = $clientLogin.access_token

Write-Host "[5/8] GET /users as admin"
$adminHeaders = @{ Authorization = "Bearer $adminToken" }
$usersPage = Invoke-RestMethod -Method Get -Uri "$BaseUrl/users?page=1&limit=10" -Headers $adminHeaders
$usersPage | ConvertTo-Json -Depth 5

$targetUser = $usersPage.items | Where-Object { $_.type -eq "client" } | Select-Object -First 1
if (-not $targetUser) {
    throw "No client user available to run update checks."
}

$targetUserId = $targetUser.id
if (-not $targetUserId) {
    throw "No users available to run update/delete checks."
}

Write-Host "[6/8] GET /users as client (expect 403)"
$clientHeaders = @{ Authorization = "Bearer $clientToken" }
try {
    Invoke-RestMethod -Method Get -Uri "$BaseUrl/users" -Headers $clientHeaders | Out-Null
    throw "Expected 403 but client call succeeded"
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -ne 403) {
        throw "Expected 403 but received status $statusCode"
    }
    Write-Host "Client correctly blocked with 403"
}

Write-Host "[7/8] Update one user as admin"
$updateBody = @{
    city = "Munich"
    age = 28
    type = "client"
} | ConvertTo-Json
$updated = Invoke-RestMethod -Method Put -Uri "$BaseUrl/users/$targetUserId" -Headers $adminHeaders -ContentType "application/json" -Body $updateBody
$updated | ConvertTo-Json -Depth 5

Write-Host "[8/8] Authenticated stats endpoints"
$count = Invoke-RestMethod -Method Get -Uri "$BaseUrl/stats/count" -Headers $clientHeaders
$average = Invoke-RestMethod -Method Get -Uri "$BaseUrl/stats/average-age" -Headers $clientHeaders
$cities = Invoke-RestMethod -Method Get -Uri "$BaseUrl/stats/top-cities" -Headers $clientHeaders
$count | ConvertTo-Json -Depth 5
$average | ConvertTo-Json -Depth 5
$cities | ConvertTo-Json -Depth 5

Write-Host "[9/13] Public products list"
$productsPage = Invoke-RestMethod -Method Get -Uri "$BaseUrl/products?page=1&limit=10"
$productsPage | ConvertTo-Json -Depth 5

if (-not $productsPage.items -or $productsPage.items.Count -eq 0) {
    throw "No products found. Run seed script before verification."
}

$firstProductId = $productsPage.items[0].id

$orderBody = @{
    city = "Berlin"
    items = @(
        @{
            product_id = $firstProductId
            quantity = 1
        }
    )
} | ConvertTo-Json -Depth 5

Write-Host "[10/13] Quote client order"
$quoteResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/orders/quote" -Headers $clientHeaders -ContentType "application/json" -Body $orderBody
$quoteResponse | ConvertTo-Json -Depth 5

$quotedExpectedTotal = [Math]::Round(($quoteResponse.subtotal + $quoteResponse.tax_amount + $quoteResponse.shipping_amount), 2)
$quotedTotal = [Math]::Round($quoteResponse.total_amount, 2)
if ($quotedExpectedTotal -ne $quotedTotal) {
    throw "Quote total mismatch: expected $quotedExpectedTotal but got $quotedTotal"
}

Write-Host "[11/13] Create client order"
$clientHeaders = @{ Authorization = "Bearer $clientToken" }
$newOrder = Invoke-RestMethod -Method Post -Uri "$BaseUrl/orders" -Headers $clientHeaders -ContentType "application/json" -Body $orderBody
$newOrder | ConvertTo-Json -Depth 5

$orderExpectedTotal = [Math]::Round(($newOrder.subtotal_amount + $newOrder.tax_amount + $newOrder.shipping_amount), 2)
$orderTotal = [Math]::Round($newOrder.total_amount, 2)
if ($orderExpectedTotal -ne $orderTotal) {
    throw "Order total mismatch: expected $orderExpectedTotal but got $orderTotal"
}

Write-Host "[12/13] Client order history"
$myOrders = Invoke-RestMethod -Method Get -Uri "$BaseUrl/orders/me" -Headers $clientHeaders
$myOrders | ConvertTo-Json -Depth 5

$orderSummary = Invoke-RestMethod -Method Get -Uri "$BaseUrl/orders/$($newOrder.id)/summary" -Headers $clientHeaders
$orderSummary | ConvertTo-Json -Depth 5

$summaryExpectedTotal = [Math]::Round(($orderSummary.subtotal + $orderSummary.tax_amount + $orderSummary.shipping_amount), 2)
$summaryTotal = [Math]::Round($orderSummary.total_amount, 2)
if ($summaryExpectedTotal -ne $summaryTotal) {
    throw "Order summary total mismatch: expected $summaryExpectedTotal but got $summaryTotal"
}

Write-Host "[13/13] Admin order list and status update"
$adminOrders = Invoke-RestMethod -Method Get -Uri "$BaseUrl/orders?page=1&limit=10" -Headers $adminHeaders
$adminOrders | ConvertTo-Json -Depth 5

if ($adminOrders.items -and $adminOrders.items.Count -gt 0) {
    $orderId = $adminOrders.items[0].id
    $statusBody = @{ status = "processing" } | ConvertTo-Json
    $updatedOrder = Invoke-RestMethod -Method Put -Uri "$BaseUrl/orders/$orderId/status" -Headers $adminHeaders -ContentType "application/json" -Body $statusBody
    $updatedOrder | ConvertTo-Json -Depth 5
}

Write-Host "Verification script completed successfully"
