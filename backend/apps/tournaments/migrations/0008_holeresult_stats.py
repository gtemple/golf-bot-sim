from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tournaments', '0007_tournament_event'),
    ]

    operations = [
        migrations.AddField(
            model_name='holeresult',
            name='stats',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
