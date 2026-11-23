# 1 booking = 1 credit at all venues. 
# No auth - data travels in request body or URL.
# Since booking API doesn't require date - capacity is enforced same day and booking also happens for the same day.
# No validation against venue when redeeming a code because the requirement doc api only accepts redemption code.