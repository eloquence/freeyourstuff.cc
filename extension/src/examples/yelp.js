'use strict';
var exampleData = {
  "schemaName": "Yelp",
  "schemaVersion": 1,
  "reviews": {
    "head": {
      "reviewerName": "Erik M.",
      "reviewerID": "ad_e5f8dkOZ9Y7wng2na2g"
    },
    "data": [{
      "subject": "Great Harvest Bread Company",
      "subjectYelpURL": "http://yelp.com/biz/great-harvest-bread-company-portland",
      "date": "11/10/2015",
      "text": "One visit so far. Staff was friendly but overwhelmed by orders. Bought some Dakota bread and a cappucino. The bread is fine -- not amazing either in freshness or texture, but perfectly decent. (Toast it to really bring out the flavor.) The cappucino order was screwed up; they literally gave me a cup of steamed milk after 7 minutes or so. I didn't go back to return it; I'm sure they'd have been super-apologetic. But, prepare for that kind of thing to happen.",
      "starRating": 3
    }, {
      "subject": "Ground Kontrol Classic Arcade",
      "subjectYelpURL": "http://yelp.com/biz/ground-kontrol-classic-arcade-portland-2",
      "date": "11/5/2015",
      "text": "Cool barcade with lots of classics (both pinball + vidoe games), decent bar food and nice ambience. You can get quarters inside. Keep in mind the age restriction after 5PM and bring ID. &nbsp;As you'd expect it can get a bit noisy/crowded at times. The machines downstairs are pretty tightly packed and you may not be able to get to the one you want without disturbing some other players.",
      "starRating": 4
    }, {
      "subject": "Natural Mart",
      "subjectYelpURL": "http://yelp.com/biz/natural-mart-portland",
      "date": "11/5/2015",
      "text": "As others have noted, the name is misleading; nature has left the building if it ever inhabited it. It's a perfectly adequate convenience store with the typical mix of some reasonably priced everyday items and some with a generous margin added to the price tag. Pay attention, and don't expect more than from a Plaid Pantry or a 7-11.",
      "starRating": 3
    }, {
      "subject": "Powell’s Books",
      "subjectYelpURL": "http://yelp.com/biz/powells-books-portland-14",
      "date": "11/3/2015",
      "text": "Powell's is the real deal. If you love books, you can spend a day here and still not want to leave. Nice in-store cafe, re-sorting racks for the books, great used book bargains, nice staff picks &amp; descriptions, information desks everywhere, clear maps and reasonably sane categorization. What's not to like? Well, you'll occasionally pay a good bit more for a new book than on the soulless-website-that-shall-not-be-named. But if you want this kind of place to exist in the world, that's worth it, isn't it?",
      "starRating": 5
    }, {
      "subject": "Eat Pizza!",
      "subjectYelpURL": "http://yelp.com/biz/eat-pizza-portland",
      "date": "11/3/2015",
      "text": "Ordered veggie pizzas here a few times, never disappointed. The garlic oil makes a huge difference and the ingredients are fresh &amp; tasty. One point off because I've only received them lukewarm on delivery, even though I live downtown not that far away (delivery via GrubHub).",
      "starRating": 4
    }, {
      "subject": "Veritable Quandary",
      "subjectYelpURL": "http://yelp.com/biz/veritable-quandary-portland",
      "date": "11/3/2015",
      "text": "Definitely among the best! Caring and committed staff, fantastic selection, great ingredients, above all just really good food. As a vegetarian, I've asked them twice for the \"chef's choice\" option to just cook something up with available ingredients. The first time I got a delicious sauteed veggie selection, the second time a wonderfully creamy squash risotto. Both items were not on the menu. So if you're vegetarian/vegan, don't be scared away by the lack of obvious options -- you will get amazing food, if you ask for it. :)",
      "starRating": 5
    }, {
      "subject": "Behind the Museum Cafe",
      "subjectYelpURL": "http://yelp.com/biz/behind-the-museum-cafe-portland",
      "date": "11/3/2015",
      "text": "Wonderful selection of tea, coffee &amp; cakes in great ambience with beautiful art. Staff clearly cares about their work and I always feel welcome here. 4.5 stars, rounded up because of the experience.",
      "starRating": 5
    }, {
      "subject": "Levine’s Drycleaning",
      "subjectYelpURL": "http://yelp.com/biz/levines-drycleaning-portland-2",
      "date": "11/3/2015",
      "text": "Very high prices for low quality work. Nearly $60 for simple stitches, dry cleaning and button replacements on a coat, all of which was done at a \"just barely good enough\" level of quality. I don't mind supporting local businesses but this one should just shut down.",
      "starRating": 1
    }, {
      "subject": "Laughing Planet Cafe",
      "subjectYelpURL": "http://yelp.com/biz/laughing-planet-cafe-portland-10",
      "date": "10/29/2015",
      "text": "Very decent food &amp; friendly service. Great options for vegetarians (and you can add tempeh or tofu to anything). Serving size is moderate so go ahead and order a side or a salad with your meal. ;-)",
      "starRating": 4
    }, {
      "subject": "Float On",
      "subjectYelpURL": "http://yelp.com/biz/float-on-portland",
      "date": "10/29/2015",
      "text": "Really friendly staff and a great environment for this kind of experience. Nice to have different tank options and late night time slots. Plus their online booking system actually works (unlike so many). A++ would float again. ;)",
      "starRating": 5
    }, {
      "subject": "Prasad",
      "subjectYelpURL": "http://yelp.com/biz/prasad-portland",
      "date": "10/22/2015",
      "text": "Really fantastic fresh food with unique flavors. Highly recommend their smoothies and their breakfast options. Their scrambles are great and very filling -- would be lovely if they served something like that for lunch, as well.",
      "starRating": 5
    }, {
      "subject": "India House",
      "subjectYelpURL": "http://yelp.com/biz/india-house-portland",
      "date": "10/7/2015",
      "text": "Worst Sag Paneer I've ever had -- no texture, entirely bland. Their cherry naan was at least interesting though not very naan-like (soggy and so sweet that it could pass for dessert). <br><br>l'll try a lot of other Indian restaurants/carts before giving this one another try. In fairness, this was a delivery, which was done fairly quickly; based on the other reviews the experience of dining there in person may be better.",
      "starRating": 2
    }, {
      "subject": "The House of Ramen",
      "subjectYelpURL": "http://yelp.com/biz/the-house-of-ramen-portland",
      "date": "10/3/2015",
      "text": "I'd give this a 3.5 but rounding up on account of good service &amp; vibe. Nice choices for vegetarians. The broths I've tried (miso &amp; tomato) pack a punch, which I enjoy but might not be for everyone. The edamame was a bit mushy. Serving sizes are generous and lunch here will definitely carry you through the rest of your day.",
      "starRating": 4
    }, {
      "subject": "DC Vegetarian Cart",
      "subjectYelpURL": "http://yelp.com/biz/dc-vegetarian-cart-portland-2",
      "date": "10/2/2015",
      "text": "Great vegetarian+vegan comfort food, lovingly prepared. A bit on the heavy side but when that's exactly what you're craving, don't hesitate. Not far from the waterfront if you're looking for a nice place to sit down.<br><br>Individual menu items I've tried:<br>1) Italian sub - really solid, fresh &amp; filling. Five stars.<br>2) BLT on wheat (with avocado - do it!) - fantastic, with great veggie bacon and lovely nutty flavor. Five stars.<br>3) Bacon cheeseburger - decent, but didn't love the cartmade patty. Four stars. [*]<br>4) Chicken salad - ginormous but a bit bland (basically just a huge amount of soy curls). Maybe try it with some extras. Three stars as-is.<br><br>[*] There are veggie patties and then there are \"fake meat\" patties. This one falls more on the veggie side. I'm personally more a fan of patties that come closer to meat-like flavors &amp; texture without the dead animals (e.g., Beyond Meat's Beast Burger patties). YMMV.",
      "starRating": 5
    }, {
      "subject": "Veggie Grill",
      "subjectYelpURL": "http://yelp.com/biz/veggie-grill-portland",
      "date": "10/2/2015",
      "text": "This place is alright but a bit overrated. The food here is not always evenly heated, and the flavors are a bit bland. On the plus side, staff is super friendly, service is quick, and there's a loyalty program for regulars. There's also a nice (if pricy) juice bar just around the corner. <br><br>As a lunch alternative, I recommend checking out some of the vegetarian food carts, e.g. DC Vegetarian, which isn't far away.",
      "starRating": 3
    }, {
      "subject": "Harvest Urban Market",
      "subjectYelpURL": "http://yelp.com/biz/harvest-urban-market-san-francisco",
      "date": "9/8/2015",
      "text": "Your one stop destination for overpriced, expired goods. If that's not your cup of tea, avoid. The only reason to come here is if you're close by, need something urgently, and are willing to pay extra close attention to ensure you don't accidentally buy something that might make you sick. Amazing they're still in business, really.",
      "starRating": 1
    }]
  }
};

var exampleSchema = {
  "schema": {
    "schemaName": "Yelp",
    "schemaVersion": 1
  },
  "reviews": {
    "label": {
      "en": "Yelp reviews"
    },
    "head": {
      "reviewerName": {
        "type": "text",
        "label": {
          "en": "Reviewer name"
        },
        "description": {
          "en": "The publicly visible name of the reviewer"
        }
      },
      "reviewerID": {
        "type": "text",
        "label": {
          "en": "Reviewer ID"
        },
        "description": {
          "en": "The unique ID assigned to the user"
        }
      }
    },
    "data": {
      "subject": {
        "type": "text",
        "label": {
          "en": "Subject"
        },
        "description": {
          "en": "A business, place, or other subject of the review"
        }
      },
      "subjectYelpURL": {
        "type": "weburl",
        "label": {
          "en": "Yelp URL"
        },
        "description": {
          "en": "The URL pointing to all Yelp reviews for the business/place that is being reviewed"
        },
        "describes": "subject"
      },
      "date": {
        "type": "date",
        "label": {
          "en": "Date"
        },
        "description": {
          "en": "The date the review was posted"
        }
      },
      "text": {
        "type": "html",
        "label": {
          "en": "Text"
        },
        "description": {
          "en": "The full text of the review"
        }
      },
      "starRating": {
        "type": "number",
        "label": {
          "en": "Star rating"
        },
        "description": {
          "en": "The star rating of the review (1-5)"
        }
      },
      "checkins": {
        "type": "number",
        "label": {
          "en": "Check-ins"
        },
        "descrption": {
          "en": "Number of times the reviewer has checked into the restaurant"
        }
      }
    }
  }
};
