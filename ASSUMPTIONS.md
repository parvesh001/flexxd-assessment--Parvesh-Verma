# 1 booking = 1 credit at all venues. 
# No auth - data travels in request body or URL.
# Since booking API doesn't require date - capacity is enforced same day and booking also happens for the same day.
# No validation against venue when redeeming a code because the requirement doc api only accepts redemption code.# Redemption codes expire CODE_TTL_SECONDS after booking (default 3600). Expired bookings are NOT refunded (treated as a no-show) and no longer count toward venue capacity.
# Duplicate booking = same user, same venue, same (UTC) day, while an earlier booking is still active. Redeemed/expired bookings don't block a new one.
# "Day" for capacity and duplicates is the UTC calendar day.
